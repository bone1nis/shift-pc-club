<?php

namespace App\Services;

use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class EventHandler
{
    /** @param array<string,mixed> $event */
    public function process(array $event): void
    {
        if (! is_string($event['event_id'] ?? null) || ! Str::isUuid($event['event_id']) || ($event['schema_version'] ?? null) !== 1 || ! is_string($event['type'] ?? null) || ! is_array($event['payload'] ?? null)) {
            throw new \InvalidArgumentException('Invalid event envelope.');
        }
        if ($event['type'] === 'club.catalog.updated') {
            app(CatalogProjection::class)->sync();
        }
        DB::transaction(function () use ($event): void {
            if (DB::table('inbox')->where('event_id', $event['event_id'])->exists()) {
                return;
            }
            // Запись в inbox с уникальным ключом и все побочные эффекты выполняются в одной транзакции.
            DB::table('inbox')->insert(['event_id' => $event['event_id'], 'processed_at' => now()]);
            $payload = $event['payload'];
            $type = $event['type'];
            if (in_array($type, ['booking.confirmed', 'booking.cancelled', 'booking.reminder', 'booking.no_show', 'session.ending'], true) && isset($payload['user_id'])) {
                if ($type === 'booking.reminder') {
                    $b = DB::table('bookings')->where('id', $payload['booking_id'])->first();
                    if (! $b || $b->status !== 'confirmed') {
                        return;
                    }
                }
                // Уведомление о брони, которой нет (например, событие пришло от тестового или повреждённого источника), не создаётся.
                if (in_array($type, ['booking.confirmed', 'booking.cancelled', 'booking.no_show'], true)
                    && ! (is_int($payload['booking_id'] ?? null) && DB::table('bookings')->where('id', $payload['booking_id'])->exists())) {
                    Log::warning('Событие о несуществующей брони пропущено: '.$type, ['event' => 'event.unknown_booking', 'event_id' => $event['event_id']]);

                    return;
                }
                if ($type === 'session.ending') {
                    $s = DB::table('gaming_sessions')->where('id', $payload['session_id'])->first();
                    if (! $s || $s->status !== 'active' || $s->version !== $payload['version'] || now()->gte($s->ends_at)) {
                        return;
                    }
                }
                DB::table('notifications')->insertOrIgnore(['user_id' => $payload['user_id'], 'type' => $type, 'dedupe_key' => $event['event_id'], 'data' => json_encode($payload, JSON_THROW_ON_ERROR), 'created_at' => now()]);
                $notificationId = DB::table('notifications')->where('dedupe_key', $event['event_id'])->value('id');
                if ($notificationId !== null) {
                    SendNotificationEmail::dispatch((int) $notificationId)->onConnection('database')->onQueue('notifications')->afterCommit();
                }
            }
        });
    }
}
