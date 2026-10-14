<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\TokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AuthController extends Controller
{
    public function csrf(): JsonResponse
    {
        $random = bin2hex(random_bytes(32));
        $secret = (string) config('shift.csrf_secret');
        abort_unless(strlen($secret) >= 32, 503, 'CSRF configuration unavailable.');
        $token = $random.'.'.hash_hmac('sha256', $random, $secret);

        return response()->json(['data' => ['csrf_token' => $token]])->withCookie(cookie('XSRF-TOKEN', $token, 60 * 24 * 30, '/', null, (bool) config('shift.secure_cookies'), false, false, 'lax'));
    }

    public function register(Request $r): JsonResponse
    {
        $r->merge(['email' => Str::lower((string) $r->input('email'))]);
        $v = $r->validate(['name' => 'required|string|max:100', 'email' => 'required|email|max:254|unique:users,email', 'password' => 'required|string|min:12|max:72']);
        $id = DB::table('users')->insertGetId(['name' => $v['name'], 'email' => $v['email'], 'password' => Hash::make($v['password']), 'role' => 'player', 'created_at' => now(), 'updated_at' => now()]);

        return $this->newSession($id, 201);
    }

    public function login(Request $r): JsonResponse
    {
        $v = $r->validate(['email' => 'required|email', 'password' => 'required|string|max:72']);
        $u = DB::table('users')->where('email', Str::lower($v['email']))->first();
        // Проверку bcrypt выполняем и для несуществующего адреса: время ответа не выдаёт, есть ли такой аккаунт.
        $valid = Hash::check($v['password'], $u->password ?? '$2y$12$PHV0uB7oylgCNWpAQqlZUeh8gF2p/uq2EHO6ACesIp1OqYzbC8adW');
        if (! ($u && $valid && $u->blocked_at === null)) {
            // Адрес и пароль в журнал не пишем: только причина.
            Log::warning('Неудачная попытка входа', ['event' => 'auth.login_failed', 'reason' => $u && $u->blocked_at !== null ? 'blocked' : 'bad_credentials']);
        }
        abort_unless($u && $valid && $u->blocked_at === null, 401, 'Неверный email или пароль.');

        return $this->newSession((int) $u->id);
    }

    private function newSession(int $userId, int $status = 200): JsonResponse
    {
        $sid = (string) Str::uuid();
        $refresh = bin2hex(random_bytes(32));
        Log::info($status === 201 ? "Регистрация: пользователь №{$userId}" : "Вход выполнен: пользователь №{$userId}", ['event' => $status === 201 ? 'auth.registered' : 'auth.login', 'user_id' => $userId]);
        DB::transaction(function () use ($sid, $userId, $refresh): void {
            DB::table('auth_sessions')->insert(['id' => $sid, 'user_id' => $userId, 'expires_at' => now()->addDays(30), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('refresh_tokens')->insert(['session_id' => $sid, 'hash' => hash('sha256', $refresh), 'created_at' => now()]);
        });

        return $this->pair($userId, $sid, $refresh, 30 * 24 * 60, $status);
    }

    private function pair(int $userId, string $sid, string $refresh, int $refreshMinutes, int $status = 200): JsonResponse
    {
        $service = app(TokenService::class);
        $access = $service->issue($userId, $sid);
        $data = $service->actor($service->decode($access));

        return response()->json(['data' => $data], $status)
            ->withCookie(cookie('shift_access', $access, 15, '/', null, (bool) config('shift.secure_cookies'), true, false, 'lax'))
            ->withCookie(cookie('shift_refresh', $refresh, $refreshMinutes, '/api/auth', null, (bool) config('shift.secure_cookies'), true, false, 'lax'));
    }

    public function refresh(Request $r): JsonResponse
    {
        $raw = (is_string($r->cookie('shift_refresh')) ? $r->cookie('shift_refresh') : '');
        abort_unless(strlen($raw) === 64, 401, 'Refresh token required.');
        $result = DB::transaction(function () use ($raw): array {
            $token = DB::table('refresh_tokens')->where('hash', hash('sha256', $raw))->first();
            if (! $token) {
                return ['error' => 401];
            }
            $s = DB::table('auth_sessions')->where('id', $token->session_id)->lockForUpdate()->first();
            $token = DB::table('refresh_tokens')->where('id', $token->id)->first();
            if (! $s || ! $token || $s->revoked_at || now()->gte($s->expires_at)) {
                return ['error' => 401];
            }
            if ($token->used_at) {
                // Одновременный запрос из другой вкладки получает конфликт; повтор позже чем через 5 секунд отзывает всё семейство токенов.
                if (now()->diffInSeconds($token->used_at, true) <= 5) {
                    return ['error' => 409];
                }
                DB::table('auth_sessions')->where('id', $s->id)->update(['revoked_at' => now()]);

                return ['error' => 401];
            }
            $user = DB::table('users')->where('id', $s->user_id)->whereNull('blocked_at')->first();
            if (! $user) {
                return ['error' => 401];
            }
            $next = bin2hex(random_bytes(32));
            DB::table('refresh_tokens')->where('id', $token->id)->update(['used_at' => now()]);
            DB::table('refresh_tokens')->insert(['session_id' => $s->id, 'hash' => hash('sha256', $next), 'created_at' => now()]);

            return ['user_id' => (int) $s->user_id, 'sid' => $s->id, 'refresh' => $next, 'minutes' => max(1, (int) ceil(now()->diffInMinutes($s->expires_at)))];
        });
        if (isset($result['error'])) {
            return response()->json(['message' => $result['error'] === 409 ? 'Refresh already in progress; retry current access cookie.' : 'Refresh token expired or reused.', 'code' => 'refresh_rejected'], $result['error']);
        }

        return $this->pair($result['user_id'], $result['sid'], $result['refresh'], $result['minutes']);
    }

    public function me(Request $r): JsonResponse
    {
        return response()->json(['data' => $r->attributes->get('actor')]);
    }

    public function updateProfile(Request $r): JsonResponse
    {
        $values = $r->validate(['name' => 'required|string|max:100']);
        $actor = $r->attributes->get('actor');
        DB::table('users')->where('id', $actor['id'])->update(['name' => $values['name'], 'updated_at' => now()]);

        return response()->json(['data' => app(TokenService::class)->actor($r->attributes->get('claims'))]);
    }

    public function adminUsers(Request $r): JsonResponse
    {
        $values = $r->validate(['query' => 'nullable|string|max:100', 'page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1|max:100']);
        $query = DB::table('users')->orderBy('id');
        if (isset($values['query']) && $values['query'] !== '') {
            $term = '%'.$values['query'].'%';
            $query->where(function ($users) use ($term): void {
                $users->where('name', 'ilike', $term)->orWhere('email', 'ilike', $term);
            });
        }
        $page = (int) ($values['page'] ?? 1);
        $perPage = (int) ($values['per_page'] ?? 25);
        $users = $query->paginate($perPage, ['id', 'name', 'email', 'role', 'blocked_at', 'created_at'], 'page', $page);

        return response()->json(['data' => ['users' => $users->items(), 'page' => $users->currentPage(), 'per_page' => $users->perPage(), 'total' => $users->total()]]);
    }

    public function introspect(Request $r): JsonResponse
    {
        $v = $r->validate(['token' => 'required|string|max:8192']);
        try {
            $data = app(TokenService::class)->actor(app(TokenService::class)->decode($v['token']));
        } catch (\UnexpectedValueException|\DomainException $e) {
            abort(401, 'Session inactive.');
        } catch (HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            abort(503, 'Identity verification unavailable.');
        }

        return response()->json(['data' => $data]);
    }

    public function internalUser(int $id): JsonResponse
    {
        $user = DB::table('users')->where('id', $id)->whereNull('blocked_at')->first();
        abort_unless($user !== null, 404);

        return response()->json(['data' => ['id' => (int) $user->id, 'role' => $user->role, 'name' => $user->name, 'email' => $user->email]]);
    }

    public function logout(Request $r): JsonResponse
    {
        // Cookie обновления позволяет выйти, даже когда токен доступа уже истёк.
        $raw = (is_string($r->cookie('shift_refresh')) ? $r->cookie('shift_refresh') : '');
        $t = DB::table('refresh_tokens')->where('hash', hash('sha256', $raw))->first();
        if ($t) {
            DB::table('auth_sessions')->where('id', $t->session_id)->update(['revoked_at' => now()]);
            Log::info('Выход из аккаунта', ['event' => 'auth.logout']);
        }

        return response()->json(['data' => null])->withCookie(cookie()->forget('shift_access', '/'))->withCookie(cookie()->forget('shift_refresh', '/api/auth'));
    }

    public function logoutAll(Request $r): JsonResponse
    {
        DB::table('auth_sessions')->where('user_id', $r->attributes->get('actor')['id'])->update(['revoked_at' => now()]);

        return response()->json(['data' => null])->withCookie(cookie()->forget('shift_access', '/'))->withCookie(cookie()->forget('shift_refresh', '/api/auth'));
    }

    public function sessions(Request $r): JsonResponse
    {
        $currentSessionId = $r->attributes->get('claims')->sid ?? null;
        $sessions = DB::table('auth_sessions')->where('user_id', $r->attributes->get('actor')['id'])->whereNull('revoked_at')->where('expires_at', '>', now())->orderByDesc('created_at')->get(['id', 'created_at', 'expires_at'])
            ->map(fn (object $session): array => ['id' => $session->id, 'created_at' => $session->created_at, 'expires_at' => $session->expires_at, 'current' => $session->id === $currentSessionId])
            ->all();

        return response()->json(['data' => $sessions]);
    }

    public function revoke(Request $r, string $id): JsonResponse
    {
        DB::table('auth_sessions')->where('id', $id)->where('user_id', $r->attributes->get('actor')['id'])->update(['revoked_at' => now()]);

        return response()->json(['data' => null]);
    }

    public function forgotPassword(Request $r): JsonResponse
    {
        $v = $r->validate(['email' => 'required|email']);
        Password::sendResetLink(['email' => Str::lower($v['email'])]);

        return response()->json(['data' => ['message' => 'Если аккаунт существует, письмо отправлено.']]);
    }

    public function resetPassword(Request $r): JsonResponse
    {
        $v = $r->validate(['email' => 'required|email', 'token' => 'required|string', 'password' => 'required|string|min:12|max:72|confirmed']);
        $status = Password::reset($v, function (User $user, string $password): void {
            DB::transaction(function () use ($user, $password): void {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                DB::table('auth_sessions')->where('user_id', $user->id)->update(['revoked_at' => now()]);
            });
        });
        abort_unless($status === Password::PasswordReset, 422, 'Invalid or expired reset token.');

        return response()->json(['data' => null]);
    }
}
