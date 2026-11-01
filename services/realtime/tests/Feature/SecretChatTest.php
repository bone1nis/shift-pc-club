<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SecretChatTest extends TestCase
{
    use RefreshDatabase;

    private string $keyFile = '';

    private string $privateKey = '';

    protected function setUp(): void
    {
        parent::setUp();
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        self::assertNotFalse($key);
        openssl_pkey_export($key, $this->privateKey);
        $this->keyFile = tempnam(sys_get_temp_dir(), 'jwt');
        file_put_contents($this->keyFile, openssl_pkey_get_details($key)['key']);
        config(['shift.jwt_public_key_path' => $this->keyFile, 'shift.csrf_secret' => str_repeat('s', 32)]);
    }

    protected function tearDown(): void
    {
        @unlink($this->keyFile);
        parent::tearDown();
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $files
     */
    private function api(string $method, string $uri, int $user, string $role = 'player', array $body = [], array $files = []): TestResponse
    {
        $now = time();
        $nonce = str_repeat('a', 64);
        $csrf = $nonce.'.'.hash_hmac('sha256', $nonce, str_repeat('s', 32));
        $cookies = ['XSRF-TOKEN' => $csrf, 'shift_access' => JWT::encode(['iss' => 'shift-identity', 'aud' => 'shift-api', 'sub' => (string) $user, 'sid' => 's1', 'iat' => $now, 'nbf' => $now, 'exp' => $now + 900], $this->privateKey, 'RS256')];
        Http::swap(new Factory);
        Http::fake(['*' => Http::response(['data' => ['id' => $user, 'name' => "User {$user}", 'role' => $role]])]);
        $server = ['HTTP_ORIGIN' => config('shift.origin'), 'HTTP_X_XSRF_TOKEN' => $csrf, 'HTTP_ACCEPT' => 'application/json'];

        return $this->withCredentials()->withUnencryptedCookies($cookies)->call($method, '/api/realtime/'.$uri, $body, $this->prepareCookiesForRequest(), $files, $server);
    }

    private function participant(int $booking, int $user, string $role = 'owner', ?string $closedAt = null): void
    {
        DB::table('booking_participants')->insert(['booking_id' => $booking, 'user_id' => $user, 'role' => $role, 'closed_at' => $closedAt, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /** Настоящая публичная точка P-256 (65 байт, base64url). */
    private function pub(): string
    {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        self::assertNotFalse($key);
        $ec = openssl_pkey_get_details($key)['ec'];

        return $this->b64("\x04".str_pad($ec['x'], 32, "\0", STR_PAD_LEFT).str_pad($ec['y'], 32, "\0", STR_PAD_LEFT));
    }

    private function device(int $user, ?string $key = null): int
    {
        return $this->api('POST', 'devices', $user, 'player', ['publicKey' => $key ?? $this->pub()])->assertSuccessful()->json('data.deviceId');
    }

    /** @param list<int> $devices */
    private function secret(array $devices, string $plain = 'steam-password-123'): array
    {
        return [
            'kind' => 'secret',
            'ciphertext' => $this->b64(str_repeat('c', 16)),
            'nonce' => $this->b64(str_repeat('n', 12)),
            'envelopes' => array_map(fn (int $d) => ['deviceId' => $d, 'ephemeralPublicKey' => $this->b64(str_repeat('e', 65)), 'nonce' => $this->b64(str_repeat('w', 12)), 'wrappedKey' => $this->b64(str_repeat('k', 48))], $devices),
        ];
    }

    public function test_device_registration_is_idempotent_and_keeps_history(): void
    {
        $key = $this->pub();
        $first = $this->api('POST', 'devices', 1, 'player', ['publicKey' => $key, 'label' => 'Телефон'])->assertCreated();
        $again = $this->api('POST', 'devices', 1, 'player', ['publicKey' => $key])->assertOk();
        $this->assertSame($first->json('data.deviceId'), $again->json('data.deviceId'));
        $this->assertSame($key, $first->json('data.publicKey'));
        // Новый ключ того же пользователя: новая строка, старая остаётся.
        $this->api('POST', 'devices', 1, 'player', ['publicKey' => $this->pub()])->assertCreated();
        $this->assertSame(2, DB::table('device_keys')->where('user_id', 1)->count());
        // Тот же ключ у другого пользователя: отдельное устройство.
        $this->assertNotSame($first->json('data.deviceId'), $this->device(2, $key));
    }

    public function test_invalid_public_key_is_422(): void
    {
        foreach (['', 'abc', 'AAAA', $this->b64(str_repeat("\x04", 65)), $this->b64("\x02".str_repeat("\x01", 64)), $this->b64(str_repeat('a', 64)), base64_encode("\x04".str_repeat('a', 64))] as $bad) {
            $this->api('POST', 'devices', 1, 'player', ['publicKey' => $bad])->assertStatus(422);
        }
        $this->api('POST', 'devices', 1, 'player', [])->assertStatus(422);
        $this->assertSame(0, DB::table('device_keys')->count());
    }

    public function test_revoke_own_only_and_revoked_key_disappears_from_keys(): void
    {
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $mine = $this->device(1);
        $theirs = $this->device(2);
        $this->api('DELETE', "devices/{$theirs}", 1)->assertNotFound();
        $this->assertNull(DB::table('device_keys')->where('id', $theirs)->value('revoked_at'));
        $this->api('DELETE', "devices/{$mine}", 1)->assertNoContent();
        $this->api('DELETE', "devices/{$mine}", 1)->assertNoContent();
        $this->assertNotNull(DB::table('device_keys')->where('id', $mine)->value('revoked_at'));
        $this->assertSame([$theirs], array_column($this->api('GET', 'conversations/10/keys', 1)->assertOk()->json('data'), 'deviceId'));
        $key = DB::table('device_keys')->where('id', $mine)->value('public_key');
        $this->api('POST', 'devices', 1, 'player', ['publicKey' => $key])->assertStatus(409);
    }

    public function test_keys_only_for_participants_and_only_their_booking(): void
    {
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $this->participant(11, 3);
        $a = $this->device(1);
        $b = $this->device(2);
        $this->device(3);
        $this->api('GET', 'conversations/10/keys', 3)->assertForbidden();
        $this->api('GET', 'conversations/10/keys', 50, 'admin')->assertForbidden();
        $data = $this->api('GET', 'conversations/10/keys', 2)->assertOk()->json('data');
        $this->assertSame([$a, $b], array_column($data, 'deviceId'));
        $this->assertSame([1, 2], array_column($data, 'userId'));
        $this->assertSame(['deviceId', 'userId', 'publicKey', 'createdAt'], array_keys($data[0]));
    }

    public function test_full_envelope_set_is_accepted_and_stored_without_plaintext(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $d1 = $this->device(1);
        $d1b = $this->device(1);
        $d2 = $this->device(2);
        $this->device(3); // не участник брони: конверт не нужен

        $payload = $this->secret([$d1, $d1b, $d2]);
        $res = $this->api('POST', 'conversations/10/messages', 1, 'player', $payload)->assertCreated();
        $this->assertSame('secret', $res->json('data.kind'));
        $this->assertNull($res->json('data.body'));
        $this->assertSame($payload['ciphertext'], $res->json('data.ciphertext'));
        $this->assertSame($payload['envelopes'], $res->json('data.envelopes'));

        $row = DB::table('messages')->first();
        $this->assertSame('secret', $row->kind);
        $this->assertNull($row->body);
        $this->assertEqualsCanonicalizing($payload['envelopes'], json_decode($row->envelopes, true));

        Event::assertDispatched(MessageSent::class, function (MessageSent $e): bool {
            $w = $e->broadcastWith();

            return $e->bookingId === 10 && $w['kind'] === 'secret' && $w['body'] === null && isset($w['ciphertext'], $w['nonce']) && count($w['envelopes']) === 3 && ! isset($w['attachment']);
        });

        // История другому участнику.
        $list = $this->api('GET', 'conversations/10/messages', 2)->assertOk()->json('data');
        $this->assertSame($payload['envelopes'], $list[0]['envelopes']);
        $this->assertNull($list[0]['body']);
    }

    public function test_large_secret_event_is_a_signal_only(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $d = $this->device(1);
        $res = $this->api('POST', 'conversations/10/messages', 1, 'player', ['ciphertext' => $this->b64(str_repeat('c', 8192))] + $this->secret([$d]))->assertCreated();
        $this->assertNotEmpty($res->json('data.ciphertext'));
        Event::assertDispatched(MessageSent::class, function (MessageSent $e): bool {
            $w = $e->broadcastWith();

            return $w['redacted'] === true && ! isset($w['ciphertext']) && $w['kind'] === 'secret';
        });
    }

    public function test_missing_unexpected_and_duplicate_envelopes_are_422(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $d1 = $this->device(1);
        $d2 = $this->device(2);
        $foreign = $this->device(3);

        $r = $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1]))->assertStatus(422);
        $this->assertSame('envelopes_mismatch', $r->json('code'));
        $this->assertSame([$d2], $r->json('missingDeviceIds'));

        $r = $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1, $d2, $foreign]))->assertStatus(422);
        $this->assertSame([$foreign], $r->json('unexpectedDeviceIds'));
        $this->assertSame([], $r->json('missingDeviceIds'));

        $r = $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1, $d2, $d2]))->assertStatus(422);
        $this->assertSame([$d2], $r->json('unexpectedDeviceIds'));

        // Отозванное устройство в конвертах тоже лишнее; новое устройство нужно покрыть.
        $this->api('DELETE', "devices/{$d2}", 2)->assertNoContent();
        $d2new = $this->device(2);
        $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1, $d2]))->assertStatus(422);
        $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1, $d2new]))->assertCreated();

        $this->api('POST', 'conversations/10/messages', 1, 'player', ['kind' => 'secret'])->assertStatus(422);
        Event::assertDispatchedTimes(MessageSent::class, 1);
    }

    public function test_format_and_size_limits(): void
    {
        $this->participant(10, 1);
        $d = $this->device(1);
        $ok = $this->secret([$d]);
        $send = fn (array $p) => $this->api('POST', 'conversations/10/messages', 1, 'player', $p);

        $send(['ciphertext' => 'не base64!!'] + $ok)->assertStatus(422);
        $send(['ciphertext' => $this->b64(str_repeat('c', 8193))] + $ok)->assertStatus(422);
        $send(['ciphertext' => $this->b64(str_repeat('c', 15))] + $ok)->assertStatus(422);
        $send(['nonce' => $this->b64(str_repeat('n', 11))] + $ok)->assertStatus(422);
        $send(['body' => 'открытый текст'] + $ok)->assertStatus(422);
        $bad = $ok;
        $bad['envelopes'][0]['wrappedKey'] = $this->b64(str_repeat('k', 10));
        $send($bad)->assertStatus(422);
        $bad = $ok;
        $bad['envelopes'] = array_fill(0, 51, $ok['envelopes'][0]);
        $send($bad)->assertStatus(422);
        $send(['ciphertext' => $this->b64(str_repeat('c', 8192))] + $ok)->assertCreated();
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['kind' => 'photo', 'body' => 'x'])->assertStatus(422);
        $this->assertSame(1, DB::table('messages')->count());
    }

    public function test_non_participant_muted_and_closed_cannot_send_secret(): void
    {
        $this->participant(10, 1);
        $this->participant(11, 2, 'owner', now()->subMinute()->toDateTimeString());
        $d1 = $this->device(1);
        $d2 = $this->device(2);
        $this->api('POST', 'conversations/10/messages', 9, 'player', $this->secret([$d1]))->assertForbidden();
        $this->api('POST', 'conversations/11/messages', 2, 'player', $this->secret([$d2]))->assertStatus(409);
        $this->api('POST', 'conversations/10/messages', 50, 'admin', $this->secret([$d1]))->assertForbidden();
        DB::table('booking_participants')->where('booking_id', 10)->update(['muted_at' => now()]);
        $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d1]))->assertForbidden();
        $this->assertSame(0, DB::table('messages')->count());
    }

    public function test_moderator_sees_fact_of_secret_but_no_ciphertext_and_can_delete(): void
    {
        $this->participant(10, 1);
        $d = $this->device(1);
        $id = $this->api('POST', 'conversations/10/messages', 1, 'player', $this->secret([$d]))->json('data.id');
        $item = $this->api('GET', 'conversations/10/messages', 50, 'admin')->assertOk()->json('data.0');
        $this->assertSame('secret', $item['kind']);
        $this->assertTrue($item['redacted']);
        $this->assertArrayNotHasKey('ciphertext', $item);
        $this->assertArrayNotHasKey('envelopes', $item);
        $this->assertNull($item['body']);
        $this->api('DELETE', "conversations/10/messages/{$id}", 50, 'admin')->assertNoContent();
        $row = DB::table('messages')->find($id);
        $this->assertNotNull($row->deleted_at);
        $this->assertNull($row->ciphertext);
        $this->assertSame([], $this->api('GET', 'conversations/10/messages', 1)->json('data'));
    }

    public function test_admin_who_is_a_participant_gets_his_own_secret_in_full(): void
    {
        $this->participant(10, 50);
        $d = $this->device(50);
        $this->api('POST', 'conversations/10/messages', 50, 'admin', $this->secret([$d]))->assertCreated();
        $item = $this->api('GET', 'conversations/10/messages', 50, 'admin')->assertOk()->json('data.0');
        $this->assertArrayNotHasKey('redacted', $item);
        $this->assertNotEmpty($item['ciphertext']);
    }

    public function test_prune_secrets_24_hours_after_close(): void
    {
        $this->participant(10, 1, 'owner', now()->subHours(25)->toDateTimeString());
        $this->participant(11, 1, 'owner', now()->subHours(23)->toDateTimeString());
        $this->participant(12, 1);
        $d = $this->device(1);
        foreach ([10, 11, 12] as $b) {
            $cid = DB::table('conversations')->insertGetId(['booking_id' => $b, 'created_at' => now(), 'updated_at' => now()]);
            $e = $this->secret([$d]);
            DB::table('messages')->insert(['conversation_id' => $cid, 'sender_id' => 1, 'kind' => 'secret', 'ciphertext' => $e['ciphertext'], 'nonce' => $e['nonce'], 'envelopes' => json_encode($e['envelopes']), 'created_at' => now()]);
            DB::table('messages')->insert(['conversation_id' => $cid, 'sender_id' => 1, 'kind' => 'text', 'body' => 'hi', 'created_at' => now()]);
        }
        $this->artisan('chat:prune-secrets')->assertSuccessful();
        $wiped = DB::table('messages')->where('kind', 'secret')->whereNull('ciphertext')->get();
        $this->assertCount(1, $wiped);
        $this->assertNotNull($wiped[0]->deleted_at);
        $this->assertNull($wiped[0]->envelopes);
        $this->assertSame(2, DB::table('messages')->where('kind', 'secret')->whereNotNull('ciphertext')->count());
        $this->assertSame(3, DB::table('messages')->where('kind', 'text')->whereNull('deleted_at')->count());
    }
}
