<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\DB;
use stdClass;

class TokenService
{
    public function decode(string $token): stdClass
    {
        $key = file_get_contents((string) config('shift.jwt_public_key_path'));
        if ($key === false) {
            throw new \RuntimeException('JWT verification key unavailable.');
        }
        $claims = JWT::decode($token, new Key($key, 'RS256'));
        if (($claims->iss ?? null) !== config('shift.jwt_issuer') || ($claims->aud ?? null) !== config('shift.jwt_audience') || ! is_string($claims->sub ?? null) || ! ctype_digit($claims->sub) || ! is_string($claims->sid ?? null) || ! isset($claims->exp, $claims->iat, $claims->nbf) || $claims->iat > time()) {
            throw new \UnexpectedValueException('Invalid JWT claims.');
        }

        return $claims;
    }

    /** @return array{id:int,name:string,email:string,role:string} */
    public function actor(stdClass $claims): array
    {
        $session = DB::table('auth_sessions')->where('id', $claims->sid)->where('user_id', $claims->sub)->whereNull('revoked_at')->where('expires_at', '>', now())->first();
        abort_unless($session !== null, 401, 'Session is inactive.');
        $user = DB::table('users')->where('id', $claims->sub)->whereNull('blocked_at')->first();
        abort_unless($user !== null, 401, 'User is inactive.');

        return ['id' => (int) $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role];
    }

    public function issue(int $userId, string $sessionId): string
    {
        $key = file_get_contents((string) config('shift.jwt_private_key_path'));
        if ($key === false) {
            throw new \RuntimeException('JWT signing key unavailable.');
        }

        return JWT::encode(['iss' => config('shift.jwt_issuer'), 'aud' => config('shift.jwt_audience'), 'sub' => (string) $userId, 'sid' => $sessionId, 'iat' => time(), 'nbf' => time(), 'exp' => time() + 900], $key, 'RS256');
    }
}
