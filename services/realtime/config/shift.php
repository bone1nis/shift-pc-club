<?php

$dev = env('SHIFT_MODE', 'prod') === 'dev';

return [
    'mode' => env('SHIFT_MODE', 'prod'),
    'service' => env('SERVICE_NAME', 'realtime'),
    'api_throttle_per_minute' => (int) (env('API_RATE_LIMIT') ?: ($dev ? 10000 : 120)),
    'chat_send_per_minute' => (int) (env('CHAT_SEND_RATE_LIMIT') ?: ($dev ? 10000 : 20)),
    'chat_accept_per_minute' => (int) (env('CHAT_ACCEPT_RATE_LIMIT') ?: ($dev ? 10000 : 10)),
    /** Потолок участников одной брони (владелец включён). */
    'chat_max_participants' => (int) env('CHAT_MAX_PARTICIPANTS', 10),
    'origin' => env('APP_ORIGIN', 'http://localhost:8088'),
    'internal_token' => env('INTERNAL_TOKEN'),
    'csrf_secret' => env('CSRF_SECRET'),
    'identity_url' => env('IDENTITY_URL', 'http://identity:8000'),
    'club_url' => env('CLUB_URL', 'http://club:8000'),
    'booking_url' => env('BOOKING_URL', 'http://booking:8000'),
    'jwt_public_key_path' => env('JWT_PUBLIC_KEY_PATH', '/run/secrets/jwt-public.pem'),
    'jwt_issuer' => env('JWT_ISSUER', 'shift-identity'),
    'jwt_audience' => env('JWT_AUDIENCE', 'shift-api'),
    'rabbitmq' => ['namespace' => env('RABBITMQ_NAMESPACE', 'shift'), 'host' => env('RABBITMQ_HOST', 'rabbitmq'), 'port' => (int) env('RABBITMQ_PORT', 5672), 'user' => env('RABBITMQ_USER', 'shift'), 'password' => env('RABBITMQ_PASSWORD'), 'vhost' => env('RABBITMQ_VHOST', '/')],
];
