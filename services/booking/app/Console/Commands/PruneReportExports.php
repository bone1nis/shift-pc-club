<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneReportExports extends Command
{
    protected $signature = 'reports:prune';

    protected $description = 'Delete expired report export files';

    public function handle(): int
    {
        $limit = now()->subHours((int) config('shift.export_ttl_hours'));
        DB::table('report_exports')->where('status', 'ready')->where('updated_at', '<', $limit)->orderBy('created_at')->each(function (object $export): void {
            if ($export->path !== null) {
                Storage::disk('local')->delete($export->path);
            }
            DB::table('report_exports')->where('id', $export->id)->update(['status' => 'expired', 'path' => null, 'updated_at' => now()]);
        });

        // Задача, потерянная между фиксацией и очередью (или упавший воркер), не должна навсегда оставить выгрузку в статусе «pending».
        DB::table('report_exports')->whereIn('status', ['pending', 'processing'])->where('created_at', '<', now()->subMinutes(15))
            ->update(['status' => 'failed', 'error' => 'Не удалось сформировать отчёт. Создайте выгрузку ещё раз.', 'updated_at' => now()]);

        return self::SUCCESS;
    }
}
