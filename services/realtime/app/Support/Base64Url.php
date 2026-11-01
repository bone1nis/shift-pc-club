<?php

namespace App\Support;

/** Строгий base64url без паддинга (как в packages/e2ee). */
final class Base64Url
{
    /** Раскодированные байты или null, если строка не канонический base64url. */
    public static function decode(mixed $value): ?string
    {
        if (! is_string($value) || $value === '' || preg_match('/^[A-Za-z0-9_-]+$/', $value) !== 1 || strlen($value) % 4 === 1) {
            return null;
        }
        $raw = base64_decode(strtr($value, '-_', '+/'), true);
        if ($raw === false || rtrim(strtr(base64_encode($raw), '+/', '-_'), '=') !== $value) {
            return null;
        }

        return $raw;
    }

    public static function isLength(mixed $value, int $bytes): bool
    {
        $raw = self::decode($value);

        return $raw !== null && strlen($raw) === $bytes;
    }

    /** Несжатая точка P-256 (65 байт, 0x04…), реально лежащая на кривой. */
    public static function isP256Point(mixed $value): bool
    {
        $raw = self::decode($value);
        if ($raw === null || strlen($raw) !== 65 || $raw[0] !== "\x04") {
            return false;
        }
        $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');

        return openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($der.$raw), 64, "\n").'-----END PUBLIC KEY-----') !== false;
    }
}
