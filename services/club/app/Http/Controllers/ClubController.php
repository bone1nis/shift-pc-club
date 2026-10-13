<?php

namespace App\Http\Controllers;

use App\Services\Outbox;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ClubController extends Controller
{
    public function catalog(): JsonResponse
    {
        return response()->json(['data' => ['zones' => DB::table('zones')->orderBy('id')->get(), 'workstations' => DB::table('workstations')->orderBy('id')->get()->map(function ($w) {
            $w->specs = json_decode($w->specs, true, 512, JSON_THROW_ON_ERROR);

            return $w;
        }), 'tariffs' => DB::table('tariffs')->orderBy('id')->get()]]);
    }

    public function profile(): JsonResponse
    {
        $profile = DB::table('club_profile')->where('id', 1)->first();
        abort_unless($profile !== null, 404);
        $profile->hours = json_decode($profile->hours, true, 512, JSON_THROW_ON_ERROR);
        $profile->latitude = (float) $profile->latitude;
        $profile->longitude = (float) $profile->longitude;

        return response()->json(['data' => $profile]);
    }

    public function updateProfile(Request $r): JsonResponse
    {
        $v = $r->validate([
            'name' => 'required|string|max:80',
            'tagline' => 'required|string|max:160',
            'description' => 'required|string|max:2000',
            'city' => 'required|string|max:80',
            'address' => 'required|string|max:200',
            'landmark' => 'required|string|max:200',
            'phone' => ['required', 'string', 'max:32', 'regex:/^[0-9+()\\-\\s]{5,32}$/'],
            'email' => 'required|email|max:120',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'hours' => 'required|array|min:1|max:8',
            'hours.*.label' => 'required|string|max:60',
            'hours.*.value' => 'required|string|max:120',
        ]);
        abort_unless(DB::table('club_profile')->where('id', 1)->exists(), 404);
        $v['hours'] = json_encode(array_values($v['hours']), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $this->save($r, 'club_profile', 1, $v);

        return $this->profile();
    }

    public function zone(Request $r, ?int $id = null): JsonResponse
    {
        $v = $r->validate(['name' => 'required|string|max:80', 'slug' => ['required', 'alpha_dash', 'max:80', Rule::unique('zones', 'slug')->ignore($id)], 'description' => 'required|string|max:2000']);
        $id = $this->save($r, 'zones', $id, $v);

        return response()->json(['data' => DB::table('zones')->where('id', $id)->first()], $r->isMethod('POST') ? 201 : 200);
    }

    public function workstation(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['name' => ['sometimes', 'required', 'string', 'max:80', Rule::unique('workstations', 'name')->ignore($id)], 'status' => 'sometimes|in:available,maintenance', 'x' => 'sometimes|integer|min:0|max:1000', 'y' => 'sometimes|integer|min:0|max:1000', 'specs' => 'sometimes|array:cpu,gpu,ram,monitor', 'specs.cpu' => 'required_with:specs|string|max:120', 'specs.gpu' => 'required_with:specs|string|max:120', 'specs.ram' => 'required_with:specs|string|max:120', 'specs.monitor' => 'required_with:specs|string|max:120']);
        // Booking должен подтвердить, что место недоступно, прежде чем Club посчитает обслуживание оформленным.
        $w = DB::table('workstations')->where('id', $id)->first();
        abort_unless($w !== null, 404);
        if (isset($v['status']) && $v['status'] === 'maintenance') {
            try {
                $response = Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])->post(config('shift.booking_url').'/api/booking/internal/workstations/'.$id.'/maintenance', ['blocked' => true]);
            } catch (ConnectionException $e) {
                abort(503, 'Booking coordination unavailable.');
            }
            abort_unless($response->successful(), 409, 'Место имеет будущие брони или активную сессию.');
        }
        if (isset($v['specs'])) {
            $v['specs'] = json_encode($v['specs'], JSON_THROW_ON_ERROR);
        }
        try {
            $this->save($r, 'workstations', $id, $v, 'club.catalog.updated');
        } catch (\Throwable $e) {
            if (($v['status'] ?? null) === 'maintenance' && $w->status !== 'maintenance') {
                // Club не смог сохранить изменение после того, как Booking заблокировал место: снимаем блокировку, чтобы сервисы остались согласованными.
                try {
                    Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])->post(config('shift.booking_url').'/api/booking/internal/workstations/'.$id.'/maintenance', ['blocked' => false]);
                } catch (ConnectionException) {
                    // Если снять блокировку не удалось, место остаётся заблокированным в Booking до повтора обновления.
                }
            }

            throw $e;
        }
        if (($v['status'] ?? null) === 'available') {
            try {
                $response = Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])->post(config('shift.booking_url').'/api/booking/internal/workstations/'.$id.'/maintenance', ['blocked' => false]);
                abort_unless($response->successful(), 503, 'Maintenance release pending; retry this update.');
            } catch (ConnectionException $e) {
                abort(503, 'Maintenance release pending; retry this update.');
            }
        }

        return $this->catalog();
    }

    public function tariff(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['name' => 'sometimes|required|string|max:80', 'hourly_price' => 'required|integer|min:100|max:1000000']);
        $this->save($r, 'tariffs', $id, $v, 'club.catalog.updated');

        return $this->catalog();
    }

    /** @param array<string,mixed> $values */
    private function save(Request $r, string $table, ?int $id, array $values, ?string $event = null): int
    {
        return DB::transaction(function () use ($r, $table, $id, $values, $event): int {
            $values['updated_at'] = now();
            if ($id) {
                $row = DB::table($table)->where('id', $id)->lockForUpdate()->first();
                abort_unless($row !== null, 404);
                if (isset($row->version)) {
                    $values['version'] = $row->version + 1;
                }DB::table($table)->where('id', $id)->update($values);
            } else {
                $values['created_at'] = now();
                $id = DB::table($table)->insertGetId($values);
            }
            Log::info("Каталог клуба изменён: {$table} №{$id}", ['event' => 'catalog.changed', 'entity' => $table, 'entity_id' => $id, 'actor_id' => $r->attributes->get('actor')['id']]);
            DB::table('audit_entries')->insert(['actor_id' => $r->attributes->get('actor')['id'], 'action' => 'updated', 'entity' => $table, 'entity_id' => $id, 'changes' => json_encode($values, JSON_THROW_ON_ERROR), 'created_at' => now()]);
            if ($event) {
                Outbox::record($event, ['entity' => $table, 'id' => $id, 'version' => $values['version'] ?? 1]);
            }

            return $id;
        });
    }

    public function audit(): JsonResponse
    {
        return response()->json(['data' => DB::table('audit_entries')->orderByDesc('id')->limit(100)->get()]);
    }
}
