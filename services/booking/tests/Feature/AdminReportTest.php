<?php

namespace Tests\Feature;

use App\Services\AdminReportService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AdminReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_uses_club_days_and_counts_completed_charges_separately_from_bookings(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-13T01:00:00Z'));
        foreach ([1, 2] as $id) {
            DB::table('workstations')->insert(['id' => $id, 'zone_id' => 1, 'name' => 'PC-'.$id, 'status' => 'available', 'version' => 1, 'hourly_price' => 18000, 'synced_at' => now()]);
        }
        foreach ([['2026-10-11T21:00:00Z', 'confirmed'], ['2026-10-12T12:00:00Z', 'cancelled'], ['2026-10-12T21:00:00Z', 'confirmed']] as [$start, $status]) {
            DB::table('bookings')->insert(['user_id' => 42, 'status' => $status, 'starts_at' => $start, 'ends_at' => CarbonImmutable::parse($start)->addHour(), 'total_price' => 90000]);
        }
        foreach ([['2026-10-12T19:00:00Z', '2026-10-12T20:00:00Z', 1], ['2026-10-12T20:00:00Z', '2026-10-12T21:00:00Z', 2]] as [$start, $end, $station]) {
            DB::table('gaming_sessions')->insert(['workstation_id' => $station, 'user_id' => 42, 'status' => 'completed', 'starts_at' => $start, 'ends_at' => $end, 'ended_at' => $end, 'hourly_price' => 18000, 'total_price' => 18000]);
        }
        $report = app(AdminReportService::class)->report('2026-10-12', '2026-10-12');
        self::assertSame(2, $report['bookings']);
        self::assertSame(1, $report['confirmed_bookings']);
        self::assertSame(1, $report['cancelled_bookings']);
        self::assertSame(1, $report['completed_sessions']);
        self::assertSame(18000, $report['earned_price']);
        self::assertSame(2.0, $report['occupied_hours']);
        self::assertSame(4.17, $report['occupancy_percent']);
        self::assertSame('Europe/Moscow', $report['timezone']);
        self::assertSame('2026-10-01', app(AdminReportService::class)->report()['from']);
    }

    public function test_reversed_period_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        app(AdminReportService::class)->report('2026-10-13', '2026-10-12');
    }

    public function test_report_counts_no_shows_separately(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-13T01:00:00Z'));
        foreach ([['2026-10-12T12:00:00Z', 'no_show'], ['2026-10-12T14:00:00Z', 'cancelled']] as [$start, $status]) {
            DB::table('bookings')->insert(['user_id' => 42, 'status' => $status, 'starts_at' => $start, 'ends_at' => CarbonImmutable::parse($start)->addHour(), 'total_price' => 90000]);
        }
        $report = app(AdminReportService::class)->report('2026-10-12', '2026-10-12');
        self::assertSame(1, $report['no_show_bookings']);
        self::assertSame(1, $report['cancelled_bookings']);
        self::assertSame(2, $report['bookings']);
    }
}
