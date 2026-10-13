<?php

namespace App\Console\Commands;

use App\Jobs\SendNotificationEmail;
use App\Services\Outbox;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileSchedule extends Command
{
    protected $signature = 'club:reconcile';

    protected $description = 'Recover due booking reminders, no-shows and session endings after scheduler downtime.';

    public function handle(): int
    {
        foreach (DB::table('bookings')->where('status', 'confirmed')->where('starts_at', '<=', now()->addHour())->pluck('id') as $id) {
            DB::transaction(function () use ($id): void {
                $b = DB::table('bookings')->where('id', $id)->lockForUpdate()->first();
                if (! $b || $b->status !== 'confirmed') {
                    return;
                }
                if (now()->gte(CarbonImmutable::parse($b->starts_at)->addMinutes((int) config('shift.no_show_grace_minutes')))) {
                    DB::table('bookings')->where('id', $id)->update(['status' => 'no_show', 'updated_at' => now()]);
                    DB::table('allocations')->where('booking_id', $id)->update(['active' => false]);
                    Outbox::record('booking.no_show', ['booking_id' => (int) $id, 'user_id' => (int) $b->user_id]);

                    return;
                }
                $key = 'booking-reminder-'.$id;
                if (! DB::table('notifications')->where('dedupe_key', $key)->exists()) {
                    $notificationId = DB::table('notifications')->insertGetId(['user_id' => $b->user_id, 'type' => 'booking.reminder', 'dedupe_key' => $key, 'data' => json_encode(['booking_id' => (int) $id], JSON_THROW_ON_ERROR), 'created_at' => now()]);
                    SendNotificationEmail::dispatch((int) $notificationId)->onConnection('database')->onQueue('notifications')->afterCommit();
                }
            });
        }
        foreach (DB::table('gaming_sessions')->where('status', 'active')->where('ends_at', '<=', now()->addMinutes(10))->pluck('id') as $id) {
            DB::transaction(function () use ($id): void {
                $s = DB::table('gaming_sessions')->where('id', $id)->lockForUpdate()->first();
                if (! $s || $s->status !== 'active') {
                    return;
                }
                if (now()->gte($s->ends_at)) {
                    DB::table('gaming_sessions')->where('id', $id)->update(['status' => 'awaiting_checkout', 'updated_at' => now()]);

                    return;
                }
                if ($s->user_id) {
                    $key = 'session-ending-'.$id.'-'.$s->version;
                    if (! DB::table('notifications')->where('dedupe_key', $key)->exists()) {
                        $notificationId = DB::table('notifications')->insertGetId(['user_id' => $s->user_id, 'type' => 'session.ending', 'dedupe_key' => $key, 'data' => json_encode(['session_id' => (int) $id, 'version' => $s->version], JSON_THROW_ON_ERROR), 'created_at' => now()]);
                        SendNotificationEmail::dispatch((int) $notificationId)->onConnection('database')->onQueue('notifications')->afterCommit();
                    }
                }
            });
        }

        return self::SUCCESS;
    }
}
