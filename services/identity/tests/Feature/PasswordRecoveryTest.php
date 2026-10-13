<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_link_targets_auth_and_reset_revokes_sessions_and_token(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'recovery@shift.local', 'password' => Hash::make('OldSecret2026!')]);
        DB::table('auth_sessions')->insert(['id' => (string) Str::uuid(), 'user_id' => $user->id, 'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now()]);
        $this->withCredentials()->withHeader('Origin', config('shift.origin'));
        $csrf = $this->getJson('/api/auth/csrf')->assertOk()->json('data.csrf_token');
        $this->withUnencryptedCookie('XSRF-TOKEN', $csrf)->withHeader('X-CSRF-TOKEN', $csrf);
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();
        $token = '';
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user, &$token): bool {
            $token = $notification->token;
            $url = $notification->toMail($user)->actionUrl;
            self::assertSame('/auth', parse_url($url, PHP_URL_PATH));
            parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
            self::assertSame($user->email, $query['email']);
            self::assertSame($token, $query['token']);

            return true;
        });
        $payload = ['email' => $user->email, 'token' => $token, 'password' => 'NewSecret2026!', 'password_confirmation' => 'NewSecret2026!'];
        $this->postJson('/api/auth/reset-password', $payload)->assertOk();
        self::assertTrue(Hash::check('NewSecret2026!', $user->fresh()->password));
        self::assertSame(0, DB::table('auth_sessions')->where('user_id', $user->id)->whereNull('revoked_at')->count());
        $this->postJson('/api/auth/reset-password', $payload)->assertUnprocessable();
    }
}
