<?php

namespace Tests\Feature;

use App\Http\Middleware\Authenticate;
use App\Http\Middleware\VerifyCsrf;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

class ComplaintTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(VerifyCsrf::class);
        // Роль и id берутся из заголовков, чтобы не ходить в Identity.
        $this->app->bind(Authenticate::class, fn () => new class extends Authenticate
        {
            public function handle(Request $request, Closure $next): Response
            {
                if ($request->header('X-Test-Role') === null) {
                    abort(401);
                }
                $request->attributes->set('actor', ['id' => (int) $request->header('X-Test-User', '10'), 'role' => $request->header('X-Test-Role')]);

                return $next($request);
            }
        });
    }

    /** @return array<string,mixed> */
    private function payload(int $keyId, array $over = []): array
    {
        return $over + ['category' => 'staff', 'rating' => 2, 'ownerKeyId' => $keyId, 'ephemeralPublicKey' => 'BEph_-key1', 'nonce' => 'nonce_-1', 'ciphertext' => 'Y2lwaGVy_-dGV4dA'];
    }

    private function as(string $role, int $user = 10): static
    {
        return $this->withHeaders(['X-Test-Role' => $role, 'X-Test-User' => (string) $user]);
    }

    private function registerKey(string $pub = 'PUBKEY_one'): int
    {
        return (int) $this->as('owner', 1)->putJson('/api/club/owner/key', ['publicKey' => $pub, 'backup' => '{"v":1,"blob":"opaque"}'])->assertCreated()->json('data.ownerKeyId');
    }

    public function test_admin_and_player_get_403_on_all_owner_routes(): void
    {
        $key = $this->registerKey();
        $this->as('owner', 1)->postJson('/api/club/complaints', $this->payload($key))->assertCreated();
        foreach (['admin', 'player'] as $role) {
            $this->as($role)->putJson('/api/club/owner/key', ['publicKey' => 'x', 'backup' => 'y'])->assertForbidden();
            $this->as($role)->getJson('/api/club/owner/key-backup')->assertForbidden();
            $this->as($role)->getJson('/api/club/owner/complaints')->assertForbidden();
            $this->as($role)->getJson('/api/club/owner/complaints/1')->assertForbidden();
            $this->as($role)->patchJson('/api/club/owner/complaints/1', ['status' => 'read'])->assertForbidden();
        }
    }

    public function test_anonymous_requests_are_401(): void
    {
        $this->getJson('/api/club/owner/complaints')->assertUnauthorized();
        $this->postJson('/api/club/complaints', $this->payload(1))->assertUnauthorized();
    }

    public function test_public_owner_key_is_404_then_active_key(): void
    {
        $this->getJson('/api/club/owner-key')->assertNotFound();
        $id = $this->registerKey();
        $this->getJson('/api/club/owner-key')->assertOk()->assertExactJson(['data' => ['ownerKeyId' => $id, 'publicKey' => 'PUBKEY_one']]);
    }

    public function test_stored_as_sent_and_no_author_in_responses(): void
    {
        $key = $this->registerKey();
        $body = $this->payload($key, ['envelopes' => [['deviceId' => 3, 'ephemeralPublicKey' => 'E1', 'nonce' => 'N1', 'wrappedKey' => 'W1']]]);
        $id = $this->as('player', 42)->postJson('/api/club/complaints', $body)->assertCreated()->json('data.id');
        $row = DB::table('complaints')->where('id', $id)->first();
        self::assertSame(42, (int) $row->user_id);
        self::assertSame($body['ciphertext'], $row->ciphertext);
        self::assertSame($body['nonce'], $row->nonce);
        self::assertSame($body['ephemeralPublicKey'], $row->ephemeral_public_key);
        self::assertSame($body['envelopes'], json_decode($row->envelopes, true));
        $list = $this->as('owner', 1)->getJson('/api/club/owner/complaints?status=new')->assertOk();
        $one = $this->as('owner', 1)->getJson('/api/club/owner/complaints/'.$id)->assertOk();
        foreach ([$list->getContent(), $one->getContent()] as $json) {
            self::assertStringNotContainsString('user_id', $json);
            self::assertStringNotContainsString('userId', $json);
            self::assertStringNotContainsString('"name"', $json);
        }
        self::assertSame($body['ciphertext'], $one->json('data.ciphertext'));
        self::assertSame($body['envelopes'], $one->json('data.envelopes'));
        self::assertSame('new', $one->json('data.status'));
        $this->as('owner', 1)->patchJson('/api/club/owner/complaints/'.$id, ['status' => 'closed'])->assertOk()->assertJsonPath('data.status', 'closed');
        $this->as('owner', 1)->getJson('/api/club/owner/complaints?status=new')->assertJsonCount(0, 'data');
        $this->as('owner', 1)->patchJson('/api/club/owner/complaints/'.$id, ['status' => 'bogus'])->assertUnprocessable();
        self::assertNotNull(DB::table('complaints')->where('id', $id)->value('read_at'));
    }

    public function test_unknown_owner_key_and_bad_format_are_422(): void
    {
        $key = $this->registerKey();
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key + 99))->assertUnprocessable()->assertJsonValidationErrors('ownerKeyId');
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key, ['ciphertext' => 'not base64!']))->assertUnprocessable();
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key, ['rating' => 6]))->assertUnprocessable();
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key, ['category' => 'zzz']))->assertUnprocessable();
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key, ['ciphertext' => str_repeat('A', 200001)]))->assertUnprocessable();
        self::assertSame(0, DB::table('complaints')->count());
    }

    public function test_daily_rate_limit_per_user(): void
    {
        $key = $this->registerKey();
        for ($i = 0; $i < 5; $i++) {
            $this->as('player', 7)->postJson('/api/club/complaints', $this->payload($key))->assertCreated();
        }
        $this->as('player', 7)->postJson('/api/club/complaints', $this->payload($key))->assertStatus(429);
        $this->as('player', 8)->postJson('/api/club/complaints', $this->payload($key))->assertCreated();
        self::assertSame(6, DB::table('complaints')->count());
    }

    public function test_rotation_keeps_history_and_backups(): void
    {
        $first = $this->registerKey('PUB_one');
        $second = $this->registerKey('PUB_two');
        self::assertNotSame($first, $second);
        self::assertSame(2, DB::table('owner_keys')->count());
        self::assertFalse((bool) DB::table('owner_keys')->where('id', $first)->value('active'));
        $this->getJson('/api/club/owner-key')->assertJsonPath('data.ownerKeyId', $second);
        $backup = $this->as('owner', 1)->getJson('/api/club/owner/key-backup')->assertOk()->assertJsonCount(2, 'data');
        self::assertSame('{"v":1,"blob":"opaque"}', $backup->json('data.0.blob'));
        self::assertSame([$first, $second], array_column($backup->json('data'), 'ownerKeyId'));
        // Жалоба под старым ключом ещё принимается: клиент мог открыть форму до ротации.
        $this->as('player')->postJson('/api/club/complaints', $this->payload($first))->assertCreated();
    }

    public function test_complaint_created_event_published_once(): void
    {
        $key = $this->registerKey();
        $id = $this->as('player')->postJson('/api/club/complaints', $this->payload($key))->assertCreated()->json('data.id');
        $rows = DB::table('outbox')->where('type', 'complaint.created')->get();
        self::assertCount(1, $rows);
        $event = json_decode($rows[0]->payload, true);
        self::assertEquals(['type' => 'complaint.created', 'id' => $id], $event['payload']);
        self::assertStringNotContainsString('ciphertext', $rows[0]->payload);
        // Отклонённая отправка событие не создаёт.
        $this->as('player')->postJson('/api/club/complaints', $this->payload($key + 5))->assertUnprocessable();
        self::assertSame(1, DB::table('outbox')->where('type', 'complaint.created')->count());
    }
}
