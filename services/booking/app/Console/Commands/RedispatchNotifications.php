<?php

namespace App\Console\Commands;

use App\Jobs\SendNotificationEmail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RedispatchNotifications extends Command
{
    protected $signature = 'notifications:redispatch';

    protected $description = 'Queue emails for recent notifications that never got a delivery job.';

    public function handle(): int
    {
        // Старые записи намеренно пропускаются: запоздавшее письмо «бронь подтверждена» только запутает гостя.
        DB::table('notifications')->where('delivery_status', 'pending')
            ->where('delivery_attempts', 0)
            ->whereBetween('created_at', [now()->subHour(), now()->subMinutes(5)])
            ->orderBy('id')->limit(100)->pluck('id')
            ->each(fn ($id) => SendNotificationEmail::dispatch((int) $id)->onConnection('database')->onQueue('notifications'));

        return self::SUCCESS;
    }
}
