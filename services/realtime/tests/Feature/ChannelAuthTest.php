<?php

namespace Tests\Feature;

use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ChannelAuthTest extends TestCase
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

    /** @param array<string, mixed> $actor */
    private function authorizeChannel(string $channel, ?array $actor, bool $csrf = true): TestResponse
    {
        $cookies = [];
        $headers = ['Origin' => config('shift.origin')];
        if ($actor !== null) {
            $now = time();
            $cookies['shift_access'] = JWT::encode(['iss' => 'shift-identity', 'aud' => 'shift-api', 'sub' => (string) $actor['id'], 'sid' => 's1', 'iat' => $now, 'nbf' => $now, 'exp' => $now + 900], $this->privateKey, 'RS256');
            Http::swap(new Factory);
            Http::fake(['*' => Http::response(['data' => $actor])]);
        }
        if ($csrf) {
            $nonce = str_repeat('a', 64);
            $token = $nonce.'.'.hash_hmac('sha256', $nonce, str_repeat('s', 32));
            $cookies['XSRF-TOKEN'] = $token;
            $headers['X-XSRF-TOKEN'] = $token;
        }

        return $this->withCredentials()->withUnencryptedCookies($cookies)->postJson('/api/realtime/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => $channel], $headers);
    }

    /** @return array{id:int,name:string,role:string} */
    private function actor(int $id, string $role): array
    {
        return ['id' => $id, 'name' => "User {$id}", 'email' => "u{$id}@shift.local", 'role' => $role];
    }

    private function participant(int $booking, int $user, ?string $closedAt = null): void
    {
        DB::table('booking_participants')->insert(['booking_id' => $booking, 'user_id' => $user, 'role' => 'player', 'closed_at' => $closedAt, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_requires_token(): void
    {
        $this->authorizeChannel('private-user.1', null)->assertUnauthorized();
    }

    public function test_requires_csrf(): void
    {
        $this->authorizeChannel('private-user.1', $this->actor(1, 'player'), false)->assertStatus(419);
    }

    public function test_user_channel_only_for_owner_of_id(): void
    {
        $this->authorizeChannel('private-user.1', $this->actor(1, 'player'))->assertOk()->assertJsonStructure(['auth']);
        $this->authorizeChannel('private-user.2', $this->actor(1, 'player'))->assertForbidden();
    }

    public function test_hall_channel_roles(): void
    {
        $this->authorizeChannel('private-hall', $this->actor(1, 'player'))->assertForbidden();
        $this->authorizeChannel('private-hall', $this->actor(2, 'admin'))->assertOk();
        $this->authorizeChannel('private-hall', $this->actor(3, 'owner'))->assertOk();
    }

    public function test_owner_channel_only_for_owner(): void
    {
        $this->authorizeChannel('private-owner', $this->actor(2, 'admin'))->assertForbidden();
        $this->authorizeChannel('private-owner', $this->actor(3, 'owner'))->assertOk();
    }

    public function test_booking_chat_only_for_participants_including_closed(): void
    {
        $this->participant(10, 1);
        $this->participant(11, 1, now()->subDay()->toDateTimeString());
        $this->authorizeChannel('private-booking.10.chat', $this->actor(1, 'player'))->assertOk();
        $this->authorizeChannel('private-booking.10.chat', $this->actor(2, 'player'))->assertForbidden();
        $this->authorizeChannel('private-booking.11.chat', $this->actor(1, 'player'))->assertOk();
        $this->authorizeChannel('private-booking.abc.chat', $this->actor(1, 'player'))->assertForbidden();
    }

    public function test_presence_returns_minimal_user_data(): void
    {
        $this->participant(10, 1);
        $response = $this->authorizeChannel('presence-booking.10.chat', $this->actor(1, 'player'))->assertOk();
        $data = json_decode((string) $response->json('channel_data'), true);
        self::assertSame(['user_id' => '1', 'user_info' => ['id' => 1, 'name' => 'User 1']], $data);
        $this->authorizeChannel('presence-booking.10.chat', $this->actor(2, 'player'))->assertForbidden();
    }

    public function test_unknown_channel_forbidden(): void
    {
        $this->authorizeChannel('private-other', $this->actor(1, 'admin'))->assertForbidden();
    }
}
