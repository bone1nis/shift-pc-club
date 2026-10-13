<?php

namespace App\Http\Controllers;

use App\Jobs\SendNotificationEmail;
use App\Services\AdminReportService;
use App\Services\CatalogProjection;
use App\Services\ReservationService;
use App\Services\SessionService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class BookingController extends Controller
{
    public function __construct(private ReservationService $reservations, private SessionService $sessions, private CatalogProjection $catalog) {}

    public function availability(Request $r): JsonResponse
    {
        $v = $r->validate(['starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at']);
        [$s,$e] = $this->reservations->interval($v['starts_at'], $v['ends_at']);
        $this->catalog->ensureFresh();
        $busy = DB::table('allocations')->where('active', true)->where('starts_at', '<', $e)->where('ends_at', '>', $s)->pluck('workstation_id')->all();
        $overdue = DB::table('gaming_sessions')->whereIn('status', ['active', 'awaiting_checkout'])->where('ends_at', '<=', now())->pluck('workstation_id')->all();
        $busy = array_merge($busy, $overdue);

        return response()->json(['data' => DB::table('workstations')->orderBy('id')->get()->map(fn ($w) => ['workstation_id' => (int) $w->id, 'available' => $w->status === 'available' && ! $w->maintenance_locked && ! in_array($w->id, $busy)])]);
    }

    public function create(Request $r): JsonResponse
    {
        $v = $r->validate(['workstation_ids' => 'required|array|min:1|max:20', 'workstation_ids.*' => 'required|integer|distinct|min:1', 'starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at']);
        $key = (string) $r->header('Idempotency-Key');
        abort_unless(preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) === 1, 422, 'Idempotency-Key must contain 16–128 letters, digits, hyphens or underscores.');
        $this->catalog->ensureFresh();
        $data = $this->reservations->create((int) $r->attributes->get('actor')['id'], array_values(array_map('intval', $v['workstation_ids'])), $v['starts_at'], $v['ends_at'], $key);

        return response()->json(['data' => $data], 201);
    }

    public function bookings(Request $r): JsonResponse
    {
        $q = DB::table('bookings');
        if (! $r->is('api/booking/admin/*')) {
            $q->where('user_id', $r->attributes->get('actor')['id']);
        }

        return response()->json(['data' => $q->orderByDesc('id')->limit(100)->pluck('id')->map(fn ($id) => $this->reservations->booking((int) $id))]);
    }

    public function createAdmin(Request $r): JsonResponse
    {
        $v = $r->validate(['user_id' => 'required|integer|min:1', 'workstation_ids' => 'required|array|min:1|max:20', 'workstation_ids.*' => 'required|integer|distinct|min:1', 'starts_at' => 'required|date', 'ends_at' => 'required|date|after:starts_at']);
        $key = (string) $r->header('Idempotency-Key');
        abort_unless(preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) === 1, 422, 'Invalid Idempotency-Key.');
        try {
            $response = Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])
                ->get(config('shift.identity_url').'/api/auth/internal/users/'.$v['user_id']);
        } catch (ConnectionException $exception) {
            abort(503, 'Проверка посетителя временно недоступна.');
        }
        abort_if($response->status() === 404, 422, 'Посетитель не найден или заблокирован.');
        abort_unless($response->successful() && $response->json('data.id') === (int) $v['user_id'], 503, 'Проверка посетителя временно недоступна.');
        $this->catalog->ensureFresh();
        $data = $this->reservations->create((int) $v['user_id'], array_values(array_map('intval', $v['workstation_ids'])), $v['starts_at'], $v['ends_at'], $key, (int) $r->attributes->get('actor')['id']);

        return response()->json(['data' => $data], 201);
    }

    public function booking(Request $r, int $id): JsonResponse
    {
        $b = $this->reservations->booking($id);
        abort_unless($r->attributes->get('actor')['role'] === 'admin' || $b['user_id'] === $r->attributes->get('actor')['id'], 404);

        return response()->json(['data' => $b]);
    }

    public function cancel(Request $r, int $id): JsonResponse
    {
        $actor = $r->attributes->get('actor');
        $this->reservations->cancel($id, (int) $actor['id'], $actor['role'] === 'admin');

        return response()->json(['data' => $this->reservations->booking($id)]);
    }

    public function sessions(Request $r): JsonResponse
    {
        $q = DB::table('gaming_sessions');
        if (! $r->is('api/booking/admin/*')) {
            $q->where('user_id', $r->attributes->get('actor')['id']);
        }

        return response()->json(['data' => $q->orderByDesc('id')->limit(100)->get()]);
    }

    public function checkIn(Request $r, int $id): JsonResponse
    {
        return response()->json(['data' => $this->sessions->checkIn($id, (int) $r->attributes->get('actor')['id'])]);
    }

    public function guest(Request $r): JsonResponse
    {
        $v = $r->validate(['workstation_id' => 'required|integer|min:1', 'minutes' => 'required|integer|min:30|max:720|multiple_of:30']);
        $this->catalog->ensureFresh();

        return response()->json(['data' => $this->sessions->guest((int) $v['workstation_id'], (int) $v['minutes'], (int) $r->attributes->get('actor')['id'])], 201);
    }

    public function end(Request $r, int $id): JsonResponse
    {
        return response()->json(['data' => $this->sessions->end($id, (int) $r->attributes->get('actor')['id'])]);
    }

    public function extend(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['minutes' => 'required|integer|min:30|max:720|multiple_of:30']);

        return response()->json(['data' => $this->sessions->extend($id, (int) $v['minutes'], (int) $r->attributes->get('actor')['id'])]);
    }

    public function pay(Request $r, int $id): JsonResponse
    {
        return response()->json(['data' => $this->sessions->pay($id, (int) $r->attributes->get('actor')['id'])]);
    }

    public function move(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['workstation_id' => 'required|integer|min:1']);

        return response()->json(['data' => $this->sessions->move($id, (int) $v['workstation_id'], (int) $r->attributes->get('actor')['id'])]);
    }

    public function notifications(Request $r): JsonResponse
    {
        return response()->json(['data' => DB::table('notifications')->where('user_id', $r->attributes->get('actor')['id'])->orderByDesc('id')->limit(100)->get()->map(function ($n) {
            $n->data = json_decode($n->data, true, 512, JSON_THROW_ON_ERROR);

            return $n;
        })]);
    }

    public function maintenance(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['blocked' => 'required|boolean']);
        DB::transaction(function () use ($v, $id): void {
            $w = DB::table('workstations')->where('id', $id)->lockForUpdate()->first();
            abort_unless($w !== null, 404);
            if ($v['blocked']) {
                abort_if(DB::table('allocations')->where('workstation_id', $id)->where('active', true)->where('ends_at', '>', now())->exists() || DB::table('gaming_sessions')->where('workstation_id', $id)->whereIn('status', ['active', 'awaiting_checkout'])->exists(), 409, 'Workstation is reserved or occupied.');
            }DB::table('workstations')->where('id', $id)->update(['maintenance_locked' => $v['blocked']]);
        });

        return response()->json(['data' => null]);
    }

    public function processing(): JsonResponse
    {
        $oldest = DB::table('outbox')->whereNull('published_at')->min('created_at');

        return response()->json(['data' => [
            'outbox_pending' => DB::table('outbox')->whereNull('published_at')->count(),
            'outbox_oldest_age_seconds' => $oldest ? max(0, now()->getTimestamp() - CarbonImmutable::parse($oldest)->getTimestamp()) : 0,
            'queues' => DB::table('jobs')->select('queue')->selectRaw('count(*) as waiting')->groupBy('queue')->orderBy('queue')->get(),
            'failed_jobs' => DB::table('failed_jobs')->count(),
            'recent_failed_jobs' => DB::table('failed_jobs')->orderByDesc('id')->limit(10)->get(['id', 'queue', 'failed_at'])->map(fn ($job) => ['id' => (int) $job->id, 'queue' => $job->queue, 'failed_at' => $job->failed_at]),
            'failed_notifications' => DB::table('notifications')->where('delivery_status', 'failed')->count(),
            'failed_exports' => DB::table('report_exports')->where('status', 'failed')->count(),
        ]]);
    }

    public function dailyReports(): JsonResponse
    {
        $rows = DB::table('daily_club_reports')->orderByDesc('date')->limit(30)->get()->map(function ($row) {
            $payload = json_decode($row->payload, true, 512, JSON_THROW_ON_ERROR);

            return ['date' => $row->date, 'club' => $payload['club'], 'zones' => $payload['zones']];
        });

        return response()->json(['data' => $rows]);
    }

    public function adminNotifications(): JsonResponse
    {
        return response()->json(['data' => DB::table('notifications')->orderByDesc('id')->limit(100)->get(['id', 'user_id', 'type', 'delivery_status', 'delivery_attempts', 'delivery_error', 'created_at', 'sent_at'])]);
    }

    public function retryNotification(Request $r, int $id): JsonResponse
    {
        $n = DB::table('notifications')->where('id', $id)->first();
        abort_unless($n !== null, 404);
        abort_unless($n->delivery_status === 'failed', 409, 'Повторить можно только неудавшуюся отправку.');
        DB::transaction(function () use ($r, $id): void {
            DB::table('notifications')->where('id', $id)->update(['delivery_status' => 'pending', 'delivery_error' => null]);
            DB::table('audit_entries')->insert(['actor_id' => $r->attributes->get('actor')['id'], 'action' => 'notification.retry', 'entity_id' => $id, 'changes' => json_encode(['notification_id' => $id], JSON_THROW_ON_ERROR), 'created_at' => now()]);
            SendNotificationEmail::dispatch($id)->onConnection('database')->onQueue('notifications')->afterCommit();
        });

        return response()->json(['data' => ['id' => $id, 'delivery_status' => 'pending']], 202);
    }

    public function audit(): JsonResponse
    {
        return response()->json(['data' => DB::table('audit_entries')->orderByDesc('id')->limit(100)->get()]);
    }

    public function reports(Request $request, AdminReportService $reports): JsonResponse
    {
        $values = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d', 'zone_id' => 'nullable|integer|min:1']);

        return response()->json(['data' => $reports->report($values['from'] ?? null, $values['to'] ?? null, isset($values['zone_id']) ? (int) $values['zone_id'] : null)]);
    }

    public function userHistory(int $userId): JsonResponse
    {
        $bookings = DB::table('bookings')->where('user_id', $userId)->orderByDesc('starts_at')->limit(100)->pluck('id')
            ->map(fn ($id) => $this->reservations->booking((int) $id));
        $sessions = DB::table('gaming_sessions')->where('user_id', $userId)->orderByDesc('starts_at')->limit(100)->get();

        return response()->json(['data' => ['bookings' => $bookings, 'sessions' => $sessions]]);
    }
}
