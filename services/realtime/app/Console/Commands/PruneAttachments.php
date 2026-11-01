<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneAttachments extends Command
{
    protected $signature = 'chat:prune-attachments {--days=30}';

    protected $description = 'Delete chat attachments (files and rows) N days after the booking was closed.';

    public function handle(): int
    {
        $cutoff = now()->subDays(max(1, (int) $this->option('days')));
        $disk = Storage::disk('attachments');
        $bookings = DB::table('booking_participants')->groupBy('booking_id')->havingRaw('min(closed_at) < ?', [$cutoff])->pluck('booking_id');
        $removed = 0;
        foreach ($bookings as $bookingId) {
            $conversation = DB::table('conversations')->where('booking_id', $bookingId)->first();
            if ($conversation === null) {
                continue;
            }
            foreach (DB::table('attachments')->where('conversation_id', $conversation->id)->get() as $attachment) {
                $disk->delete($attachment->path);
                DB::transaction(function () use ($attachment): void {
                    // Сообщение без текста после удаления файла пустое: помечаем его удалённым.
                    DB::table('messages')->where('attachment_id', $attachment->id)->whereNull('body')->update(['deleted_at' => now()]);
                    DB::table('messages')->where('attachment_id', $attachment->id)->update(['attachment_id' => null]);
                    DB::table('attachments')->where('id', $attachment->id)->delete();
                });
                $removed++;
            }
        }
        $this->info("Removed attachments: {$removed}");

        return self::SUCCESS;
    }
}
