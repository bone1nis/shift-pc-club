<?php

$dev = env('SHIFT_MODE', 'prod') === 'dev';

return [
    // Режим запуска: `dev` — локальная разработка и автотесты (ослабленные лимиты и окно заселения), `prod` — строгие правила.
    'mode' => env('SHIFT_MODE', 'prod'),
    'service' => env('SERVICE_NAME', 'booking'),
    'club_timezone' => env('CLUB_TIMEZONE', 'Europe/Moscow'),
    'export_ttl_hours' => (int) env('REPORT_EXPORT_TTL_HOURS', 24),
    // Правила бронирования клуба (минуты и дни). Меняйте через окружение, а не в коде.
    'booking_step_minutes' => (int) env('BOOKING_STEP_MINUTES', 30),
    'booking_max_minutes' => (int) env('BOOKING_MAX_MINUTES', 720),
    'booking_horizon_days' => (int) env('BOOKING_HORIZON_DAYS', 30),
    // В режиме dev заселять можно за 30 дней до начала: не нужно ждать «настоящего» окна при проверке сценариев.
    'checkin_early_minutes' => (int) (env('CHECKIN_EARLY_MINUTES') ?: ($dev ? 43200 : 15)),
    'no_show_grace_minutes' => (int) env('NO_SHOW_GRACE_MINUTES', 15),
    // События сайта: окно дедупликации одинаковых событий одного посетителя; боты по умолчанию не учитываются.
    'analytics' => ['dedupe_minutes' => (int) env('ANALYTICS_DEDUPE_MINUTES', 30), 'count_bots' => (bool) env('ANALYTICS_COUNT_BOTS', false)],
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
