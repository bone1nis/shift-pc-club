<?php

namespace App\Jobs;

use App\Services\ReportCsvBuilder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateReportExport implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $exportId) {}

    /**
     * Execute the job.
     */
    public function handle(ReportCsvBuilder $builder): void
    {
        $export = DB::table('report_exports')->where('id', $this->exportId)->first();
        if ($export === null || $export->status === 'ready') {
            return;
        }
        DB::table('report_exports')->where('id', $this->exportId)->update(['status' => 'processing', 'error' => null, 'updated_at' => now()]);
        $csv = $builder->build(['from' => (string) $export->from, 'to' => (string) $export->to, 'zone_id' => $export->zone_id === null ? null : (int) $export->zone_id]);
        if (! Storage::disk('local')->put('reports/'.$this->exportId.'.csv', $csv)) {
            throw new \RuntimeException('Unable to store report export.');
        }
        DB::table('report_exports')->where('id', $this->exportId)->update(['status' => 'ready', 'path' => 'reports/'.$this->exportId.'.csv', 'updated_at' => now()]);
    }

    public function failed(?Throwable $exception): void
    {
        DB::table('report_exports')->where('id', $this->exportId)->update(['status' => 'failed', 'error' => 'Не удалось сформировать отчёт. Создайте выгрузку ещё раз.', 'updated_at' => now()]);
    }
}
