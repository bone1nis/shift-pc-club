<?php

namespace Tests\Feature;

use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class DomainTest extends TestCase
{
    use RefreshDatabase;

    private function csrf(): void
    {
        // JSON-запросы браузера идут с credentials: include, чтобы CSRF-cookie доходила до Laravel.
        $this->withCredentials();
        $this->withHeader('Origin', config('shift.origin'));
        $token = $this->getJson('/api/auth/csrf')->assertOk()->json('data.csrf_token');
        $this->withUnencryptedCookie('XSRF-TOKEN', $token)->withHeader('X-CSRF-TOKEN', $token);
    }

    private function login(): TestResponse
    {
        DB::table('users')->insert(['name' => 'Player', 'email' => 'test@shift.local', 'role' => 'player', 'password' => Hash::make('TestSecret123!')]);
        $this->csrf();

        return $this->postJson('/api/auth/login', ['email' => 'test@shift.local', 'password' => 'TestSecret123!'])->assertOk();
    }

    private function cookies(TestResponse $response): array
    {
        $cookies = [];
        foreach ($response->headers->getCookies() as $cookie) {
            $cookies[$cookie->getName()] = $cookie->getValue();
        }

        return $cookies;
    }

    public function test_login_requires_signed_csrf_and_exact_origin(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'x@y.test', 'password' => 'password'])->assertStatus(419);
        $this->csrf();
        $this->withHeader('Origin', 'https://attacker.test')->postJson('/api/auth/login', ['email' => 'x@y.test', 'password' => 'password'])->assertStatus(419);
    }

    public function test_login_with_unknown_email_is_401_not_500(): void
    {
        $this->csrf();
        $this->postJson('/api/auth/login', ['email' => 'nobody@shift.local', 'password' => 'whatever123'])->assertStatus(401);
    }

    public function test_register_never_accepts_admin_role(): void
    {
        $this->csrf();
        $this->postJson('/api/auth/register', ['name' => 'Player', 'email' => 'new@shift.local', 'password' => 'TestSecret123!', 'role' => 'admin'])->assertCreated()->assertJsonPath('data.role', 'player');
    }

    public function test_profile_updates_name_but_never_email_or_role(): void
    {
        $cookies = $this->cookies($this->login());
        $this->withUnencryptedCookies($cookies)->patchJson('/api/auth/me', ['name' => 'Updated Player', 'email' => 'attacker@shift.local', 'role' => 'admin'])
            ->assertOk()->assertJsonPath('data.name', 'Updated Player')->assertJsonPath('data.email', 'test@shift.local')->assertJsonPath('data.role', 'player');
        self::assertSame('player', DB::table('users')->where('email', 'test@shift.local')->value('role'));
    }

    public function test_admin_user_search_requires_current_admin_role(): void
    {
        $cookies = $this->cookies($this->login());
        $this->withUnencryptedCookies($cookies)->getJson('/api/auth/admin/users')->assertForbidden();
        DB::table('users')->where('email', 'test@shift.local')->update(['role' => 'admin']);
        DB::table('users')->insert(['name' => 'Other player', 'email' => 'other@shift.local', 'role' => 'player', 'password' => Hash::make('TestSecret123!')]);
        // Пустая строка поиска приходит из админки при открытии раздела и не должна быть ошибкой.
        $this->getJson('/api/auth/admin/users?query=')->assertOk()->assertJsonPath('data.total', 2);
        $this->getJson('/api/auth/admin/users?query=test%40shift.local')->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.users.0.role', 'admin');
    }

    public function test_logout_revokes_access_immediately(): void
    {
        $c = $this->cookies($this->login());
        $this->withUnencryptedCookies($c)->getJson('/api/auth/me')->assertOk();
        $this->postJson('/api/auth/logout')->assertOk();
        $this->withUnencryptedCookies($c)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_sessions_mark_current_device_and_revoke_ends_it(): void
    {
        $first = $this->cookies($this->login());
        $second = $this->cookies($this->postJson('/api/auth/login', ['email' => 'test@shift.local', 'password' => 'TestSecret123!'])->assertOk());

        $list = $this->withUnencryptedCookies($first)->getJson('/api/auth/sessions')->assertOk()->json('data');
        self::assertCount(2, $list);
        self::assertCount(1, array_filter($list, fn (array $session): bool => $session['current']));

        $other = array_values(array_filter($list, fn (array $session): bool => ! $session['current']))[0];
        $this->withUnencryptedCookies($first)->deleteJson('/api/auth/sessions/'.$other['id'])->assertOk();
        $this->withUnencryptedCookies($second)->getJson('/api/auth/me')->assertUnauthorized();
        $this->withUnencryptedCookies($first)->getJson('/api/auth/me')->assertOk();
    }

    public function test_refresh_rotates_and_delayed_replay_revokes_family(): void
    {
        $old = $this->cookies($this->login());
        $new = $this->cookies($this->withUnencryptedCookies($old)->postJson('/api/auth/refresh')->assertOk());
        self::assertNotSame($old['shift_refresh'], $new['shift_refresh']);
        $this->withUnencryptedCookies($old)->postJson('/api/auth/refresh')->assertConflict();
        DB::table('refresh_tokens')->where('hash', hash('sha256', $old['shift_refresh']))->update(['used_at' => now()->subSeconds(10)]);
        $this->postJson('/api/auth/refresh')->assertUnauthorized();
        $this->withUnencryptedCookies($new)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_current_role_and_block_are_authoritative(): void
    {
        $c = $this->cookies($this->login());
        DB::table('users')->where('email', 'test@shift.local')->update(['role' => 'admin']);
        $this->withUnencryptedCookies($c)->getJson('/api/auth/me')->assertJsonPath('data.role', 'admin');
        DB::table('users')->update(['blocked_at' => now()]);
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_invalid_signature_and_expiration_are_rejected(): void
    {
        $c = $this->cookies($this->login());
        $parts = explode('.', $c['shift_access']);
        $parts[2] = str_repeat('a', strlen($parts[2]));
        $this->withUnencryptedCookie('shift_access', implode('.', $parts))->getJson('/api/auth/me')->assertUnauthorized();
        JWT::$timestamp = time() + 960;
        try {
            $this->withUnencryptedCookies($c)->getJson('/api/auth/me')->assertUnauthorized();
        } finally {
            JWT::$timestamp = null;
        }
    }

    public function test_seed_preserves_changed_accounts(): void
    {
        $this->seed();
        DB::table('users')->where('email', 'player@shift.local')->update(['name' => 'Changed']);
        $this->seed();
        self::assertSame('Changed', DB::table('users')->where('email', 'player@shift.local')->value('name'));
    }

    public function test_internal_user_lookup_is_private_and_rejects_blocked_users(): void
    {
        $id = DB::table('users')->insertGetId(['name' => 'Player', 'email' => 'lookup@shift.local', 'password' => Hash::make('TestSecret123!'), 'role' => 'player']);
        $this->getJson('/api/auth/internal/users/'.$id)->assertForbidden();
        $this->withHeader('X-Internal-Token', config('shift.internal_token'))->getJson('/api/auth/internal/users/'.$id)->assertOk()->assertJsonPath('data.id', $id);
        DB::table('users')->where('id', $id)->update(['blocked_at' => now()]);
        $this->getJson('/api/auth/internal/users/'.$id)->assertNotFound();
    }

    public function test_introspection_key_outage_is_503_and_invalid_token_401(): void
    {
        $this->withHeader('X-Internal-Token', config('shift.internal_token'))->postJson('/api/auth/internal/introspect', ['token' => 'invalid'])->assertUnauthorized();
        config(['shift.jwt_public_key_path' => '/missing/key.pem']);
        $this->postJson('/api/auth/internal/introspect', ['token' => 'invalid'])->assertStatus(503);
    }
}
