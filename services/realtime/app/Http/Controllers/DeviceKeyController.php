<?php

namespace App\Http\Controllers;

use App\Support\Base64Url;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Публичные ключи устройств для секретных сообщений (T18). Приватные ключи на сервер не попадают. */
class DeviceKeyController extends Controller
{
    private const MAX_ACTIVE_PER_USER = 20;

    private function userId(Request $request): int
    {
        /** @var array{id:int|string} $actor */
        $actor = $request->attributes->get('actor');

        return (int) $actor['id'];
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate(['publicKey' => ['required', 'string', 'max:128'], 'label' => ['nullable', 'string', 'max:80']]);
        abort_unless(Base64Url::isP256Point($data['publicKey']), 422, 'publicKey must be an uncompressed P-256 point (65 bytes, base64url).');
        $userId = $this->userId($request);
        $label = isset($data['label']) ? mb_substr(trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $data['label'])), 0, 80) : null;

        $row = DB::transaction(function () use ($userId, $data, $label) {
            // Блокировка по пользователю делает проверку лимита и вставку атомарными.
            DB::select('select pg_advisory_xact_lock(?)', [$userId]);
            $existing = DB::table('device_keys')->where('user_id', $userId)->where('public_key', $data['publicKey'])->first();
            if ($existing !== null) {
                abort_if($existing->revoked_at !== null, 409, 'This key was revoked; generate a new one.');

                return [$existing, false];
            }
            abort_if(DB::table('device_keys')->where('user_id', $userId)->whereNull('revoked_at')->count() >= self::MAX_ACTIVE_PER_USER, 422, 'Too many active devices; revoke one first.');
            $id = DB::table('device_keys')->insertGetId(['user_id' => $userId, 'public_key' => $data['publicKey'], 'device_label' => $label === '' ? null : $label, 'created_at' => now()]);

            return [DB::table('device_keys')->where('id', $id)->first(), true];
        });
        [$key, $created] = $row;
        abort_if($key === null, 500);

        return response()->json(['data' => ['deviceId' => (int) $key->id, 'userId' => $userId, 'publicKey' => $key->public_key, 'createdAt' => CarbonImmutable::parse($key->created_at)->toIso8601String()]], $created ? 201 : 200);
    }

    public function revoke(Request $request, int $id): JsonResponse
    {
        $key = DB::table('device_keys')->where('id', $id)->first();
        // Чужой ключ и несуществующий неразличимы: 404, чтобы не раскрывать чужие id.
        abort_if($key === null || (int) $key->user_id !== $this->userId($request), 404);
        DB::table('device_keys')->where('id', $id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

        return response()->json(null, 204);
    }

    public function conversationKeys(Request $request, int $bookingId): JsonResponse
    {
        abort_unless(DB::table('booking_participants')->where('booking_id', $bookingId)->where('user_id', $this->userId($request))->exists(), 403, 'Not a participant.');
        $keys = DB::table('device_keys')->whereIn('user_id', DB::table('booking_participants')->where('booking_id', $bookingId)->select('user_id'))
            ->whereNull('revoked_at')->orderBy('id')->get();

        return response()->json(['data' => $keys->map(fn ($k) => ['deviceId' => (int) $k->id, 'userId' => (int) $k->user_id, 'publicKey' => $k->public_key, 'createdAt' => CarbonImmutable::parse($k->created_at)->toIso8601String()])->all()]);
    }
}
