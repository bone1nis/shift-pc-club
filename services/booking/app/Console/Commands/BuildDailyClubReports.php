<?php

namespace App\Console\Commands;

use App\Services\AdminReportService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BuildDailyClubReports extends Command
{
    protected $signature = 'reports:daily {--days=7 : За сколько последних завершённых дней добрать пропущенные сводки}';

    protected $description = 'Save daily club report snapshots (whole club and per zone); missing days are backfilled after downtime.';

    public function handle(AdminReportService $reports): int
    {
        $timezone = (string) config('shift.club_timezone', 'Europe/Moscow');
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $zones = DB::table('workstations')->distinct()->orderBy('zone_id')->pluck('zone_id');
        for ($offset = 1; $offset <= (int) $this->option('days'); $offset++) {
            $day = $today->subDays($offset)->format('Y-m-d');
            if (DB::table('daily_club_reports')->where('date', $day)->exists()) {
                continue;
            }
            $payload = ['club' => $reports->report($day, $day), 'zones' => []];
            foreach ($zones as $zone) {
                $payload['zones'][(string) $zone] = $reports->report($day, $day, (int) $zone);
            }
            DB::table('daily_club_reports')->insertOrIgnore([
                'date' => $day,
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);
        }

        return self::SUCCESS;
    }
}
