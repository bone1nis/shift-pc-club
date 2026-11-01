<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneSecrets extends Command
{
    protected $signature = 'chat:prune-secrets {--hours=24}';

    protected $description = 'Wipe secret chat messages (ciphertext, nonce, envelopes) N hours after the booking was closed.';

    public function handle(): int
    {
        $cutoff = now()->subHours(max(1, (int) $this->option('hours')));
        $bookings = DB::table('booking_participants')->groupBy('booking_id')->havingRaw('min(closed_at) < ?', [$cutoff])->pluck('booking_id');
        $removed = 0;
        foreach ($bookings as $bookingId) {
            $conversation = DB::table('conversations')->where('booking_id', $bookingId)->first();
            if ($conversation === null) {
                continue;
            }
            $removed += DB::table('messages')->where('conversation_id', $conversation->id)->where('kind', 'secret')->whereNotNull('ciphertext')
                ->update(['ciphertext' => null, 'nonce' => null, 'envelopes' => null, 'deleted_at' => DB::raw('coalesce(deleted_at, now())')]);
        }
        $this->info("Wiped secrets: {$removed}");

        return self::SUCCESS;
    }
}
