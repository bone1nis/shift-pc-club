<?php

namespace App\Http\Controllers;

use App\Services\Outbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Жалобы владельцу: сервер хранит только шифртекст, user_id наружу не отдаётся. */
class ComplaintController extends Controller
{
    private const B64 = 'regex:/^[A-Za-z0-9_-]+$/';

    private const DAILY_LIMIT = 5;

    public function ownerKey(): JsonResponse
    {
        $key = DB::table('owner_keys')->where('active', true)->first();
        abort_unless($key !== null, 404);

        return response()->json(['data' => ['ownerKeyId' => (int) $key->id, 'publicKey' => $key->public_key]]);
    }

    public function registerKey(Request $r): JsonResponse
    {
        $v = $r->validate(['publicKey' => ['required', 'string', 'max:256', self::B64], 'backup' => 'required|string|max:100000', 'backupVersion' => 'sometimes|integer|min:1|max:1000']);
        $id = DB::transaction(function () use ($v): int {
            DB::table('owner_keys')->where('active', true)->update(['active' => false]);
            $id = DB::table('owner_keys')->insertGetId(['public_key' => $v['publicKey'], 'active' => true, 'created_at' => now()]);
            DB::table('owner_key_backup')->insert(['owner_key_id' => $id, 'blob' => $v['backup'], 'version' => $v['backupVersion'] ?? 1, 'created_at' => now()]);

            return $id;
        });

        return response()->json(['data' => ['ownerKeyId' => $id, 'publicKey' => $v['publicKey']]], 201);
    }

    public function keyBackup(): JsonResponse
    {
        $rows = DB::table('owner_keys')->join('owner_key_backup', 'owner_key_backup.owner_key_id', '=', 'owner_keys.id')->orderBy('owner_keys.id')->get(['owner_keys.id', 'owner_keys.public_key', 'owner_keys.active', 'owner_keys.created_at', 'owner_key_backup.blob', 'owner_key_backup.version']);

        return response()->json(['data' => $rows->map(fn ($k) => ['ownerKeyId' => (int) $k->id, 'publicKey' => $k->public_key, 'active' => (bool) $k->active, 'version' => (int) $k->version, 'blob' => $k->blob, 'createdAt' => $k->created_at])->all()]);
    }

    public function store(Request $r): JsonResponse
    {
        $v = $r->validate([
            'category' => 'required|in:staff,equipment,service,booking,review,other',
            'rating' => 'required|integer|between:1,5',
            'ownerKeyId' => 'required|integer|exists:owner_keys,id',
            'ephemeralPublicKey' => ['required', 'string', 'max:256', self::B64],
            'nonce' => ['required', 'string', 'max:64', self::B64],
            'ciphertext' => ['required', 'string', 'max:'.(int) config('shift.complaint_max_ciphertext', 200000), self::B64],
            'envelopes' => 'sometimes|nullable|array|max:20',
            'envelopes.*' => 'array:deviceId,ephemeralPublicKey,nonce,wrappedKey',
            'envelopes.*.deviceId' => 'required|integer|min:1',
            'envelopes.*.ephemeralPublicKey' => ['required', 'string', 'max:256', self::B64],
            'envelopes.*.nonce' => ['required', 'string', 'max:64', self::B64],
            'envelopes.*.wrappedKey' => ['required', 'string', 'max:1024', self::B64],
        ]);
        $userId = (int) $r->attributes->get('actor')['id'];
        $id = DB::transaction(function () use ($v, $userId): int {
            // Сериализуем отправки одного пользователя, чтобы лимит нельзя было обойти параллельными запросами.
            DB::select('select pg_advisory_xact_lock(?, ?)', [7315, $userId]);
            abort_if(DB::table('complaints')->where('user_id', $userId)->where('created_at', '>', now()->subDay())->count() >= self::DAILY_LIMIT, 429, 'Too many complaints.');
            $id = DB::table('complaints')->insertGetId(['user_id' => $userId, 'category' => $v['category'], 'rating' => $v['rating'], 'status' => 'new', 'owner_key_id' => $v['ownerKeyId'], 'ephemeral_public_key' => $v['ephemeralPublicKey'], 'nonce' => $v['nonce'], 'ciphertext' => $v['ciphertext'], 'envelopes' => isset($v['envelopes']) ? json_encode($v['envelopes'], JSON_THROW_ON_ERROR) : null, 'created_at' => now()]);
            Outbox::record('complaint.created', ['type' => 'complaint.created', 'id' => $id]);

            return $id;
        });

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function index(Request $r): JsonResponse
    {
        $v = $r->validate(['status' => 'sometimes|in:new,read,closed', 'page' => 'sometimes|integer|min:1']);
        $q = DB::table('complaints')->orderByDesc('id');
        if (isset($v['status'])) {
            $q->where('status', $v['status']);
        }
        $page = $q->paginate(20, ['*'], 'page', $v['page'] ?? 1);

        return response()->json(['data' => collect($page->items())->map(fn ($c) => $this->present($c))->all(), 'meta' => ['page' => $page->currentPage(), 'perPage' => $page->perPage(), 'total' => $page->total(), 'lastPage' => $page->lastPage()]]);
    }

    public function show(int $id): JsonResponse
    {
        $c = DB::table('complaints')->where('id', $id)->first();
        abort_unless($c !== null, 404);

        return response()->json(['data' => $this->present($c)]);
    }

    public function update(Request $r, int $id): JsonResponse
    {
        $v = $r->validate(['status' => 'required|in:new,read,closed']);
        $c = DB::table('complaints')->where('id', $id)->first();
        abort_unless($c !== null, 404);
        $values = ['status' => $v['status']];
        if ($v['status'] !== 'new' && $c->read_at === null) {
            $values['read_at'] = now();
        }
        DB::table('complaints')->where('id', $id)->update($values);

        return $this->show($id);
    }

    /** @return array<string,mixed> */
    private function present(\stdClass $c): array
    {
        $out = ['id' => (int) $c->id, 'category' => $c->category, 'rating' => $c->rating === null ? null : (int) $c->rating, 'ownerKeyId' => (int) $c->owner_key_id, 'ephemeralPublicKey' => $c->ephemeral_public_key, 'nonce' => $c->nonce, 'ciphertext' => $c->ciphertext, 'status' => $c->status, 'createdAt' => Carbon::parse($c->created_at)->toIso8601String()];
        if ($c->envelopes !== null) {
            $out['envelopes'] = json_decode($c->envelopes, true, 512, JSON_THROW_ON_ERROR);
        }

        return $out;
    }
}
