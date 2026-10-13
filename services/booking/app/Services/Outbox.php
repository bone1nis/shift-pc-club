<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class Outbox
{
    /** @param array<string,mixed> $payload */
    public static function record(string $type, array $payload): void
    {
        $id = (string) Str::uuid();
        Log::info(self::describe($type, $payload), ['event' => $type, 'event_id' => $id] + array_filter($payload, 'is_scalar'));
        DB::table('outbox')->insert(['id' => $id, 'type' => $type, 'payload' => json_encode(['event_id' => $id, 'type' => $type, 'schema_version' => 1, 'occurred_at' => now()->toIso8601String(), 'correlation_id' => request()->header('X-Request-ID') ?: (string) Str::uuid(), 'payload' => $payload], JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }

    /**
     * Короткое описание события для журнала: что произошло, без персональных данных.
     *
     * @param  array<string,mixed>  $payload
     */
    public static function describe(string $type, array $payload): string
    {
        $booking = $payload['booking_id'] ?? '?';
        $session = $payload['session_id'] ?? '?';

        return match ($type) {
            'booking.confirmed' => "Бронь №{$booking} создана",
            'booking.cancelled' => "Бронь №{$booking} отменена",
            'booking.checked_in' => "Бронь №{$booking} заселена",
            'booking.no_show' => "Бронь №{$booking} освобождена: неявка",
            'session.completed' => "Сессия №{$session} завершена",
            'club.catalog.updated' => 'Каталог клуба изменён: '.($payload['entity'] ?? '?').' №'.($payload['id'] ?? '?'),
            default => "Событие {$type}",
        };
    }
}
