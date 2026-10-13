<?php

$dev = env('SHIFT_MODE', 'prod') === 'dev';

return [
    // Режим запуска: `dev` — локальная разработка и автотесты (ослабленные лимиты и окно заселения), `prod` — строгие правила.
    'mode' => env('SHIFT_MODE', 'prod'),
    'service' => env('SERVICE_NAME', 'identity'),
    // Лимит попыток входа/регистрации в минуту с одного IP; для автотестов на локальном стенде можно поднять.
    'auth_throttle_per_minute' => (int) (env('AUTH_RATE_LIMIT') ?: ($dev ? 1000 : 10)),
    // Лимит запросов API в минуту с одного IP; для автотестов на локальном стенде можно поднять.
    'api_throttle_per_minute' => (int) (env('API_RATE_LIMIT') ?: ($dev ? 10000 : 120)),
    'origin' => env('APP_ORIGIN', 'http://localhost:8088'),
    'internal_token' => env('INTERNAL_TOKEN'),
    'csrf_secret' => env('CSRF_SECRET'),
    'identity_url' => env('IDENTITY_URL', 'http://identity:8000'),
    'club_url' => env('CLUB_URL', 'http://club:8000'),
    'booking_url' => env('BOOKING_URL', 'http://booking:8000'),
    'jwt_private_key_path' => env('JWT_PRIVATE_KEY_PATH', '/run/secrets/jwt-private.pem'),
    'jwt_public_key_path' => env('JWT_PUBLIC_KEY_PATH', '/run/secrets/jwt-public.pem'),
    'jwt_issuer' => env('JWT_ISSUER', 'shift-identity'),
    'jwt_audience' => env('JWT_AUDIENCE', 'shift-api'),
    'secure_cookies' => env('COOKIE_SECURE', false),
    'rabbitmq' => ['namespace' => env('RABBITMQ_NAMESPACE', 'shift'), 'host' => env('RABBITMQ_HOST', 'rabbitmq'), 'port' => (int) env('RABBITMQ_PORT', 5672), 'user' => env('RABBITMQ_USER', 'shift'), 'password' => env('RABBITMQ_PASSWORD'), 'vhost' => env('RABBITMQ_VHOST', '/')],
];
