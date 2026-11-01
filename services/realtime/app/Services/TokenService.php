<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
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
}
