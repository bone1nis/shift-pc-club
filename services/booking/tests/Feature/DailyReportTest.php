<?php

namespace Tests\Feature;

use App\Services\AdminReportService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DailyReportTest extends TestCase
{
    use DatabaseMigrations;

    private function seedClub(): void
    {
        foreach ([[1, 1], [2, 1], [3, 2]] as [$id, $zone]) {
            DB::table('workstations')->insert(['id' => $id, 'zone_id' => $zone, 'name' => 'PC-'.$id, 'status' => 'available', 'version' => 1, 'hourly_price' => 18000, 'synced_at' => now()]);
        }
        $this->travelTo(CarbonImmutable::parse('2026-10-13T01:00:00Z'));
        // Бронь на два места в разных зонах и бронь только в зоне 2.
        $both = DB::table('bookings')->insertGetId(['user_id' => 42, 'status' => 'confirmed', 'starts_at' => '2026-10-12T12:00:00Z', 'ends_at' => '2026-10-12T13:00:00Z', 'total_price' => 36000]);
        DB::table('booking_items')->insert([['booking_id' => $both, 'workstation_id' => 1, 'hourly_price' => 18000, 'price' => 18000, 'catalog_version' => 1], ['booking_id' => $both, 'workstation_id' => 3, 'hourly_price' => 18000, 'price' => 18000, 'catalog_version' => 1]]);
        $vip = DB::table('bookings')->insertGetId(['user_id' => 43, 'status' => 'cancelled', 'starts_at' => '2026-10-12T14:00:00Z', 'ends_at' => '2026-10-12T15:00:00Z', 'total_price' => 18000]);
        DB::table('booking_items')->insert(['booking_id' => $vip, 'workstation_id' => 3, 'hourly_price' => 18000, 'price' => 18000, 'catalog_version' => 1]);
        foreach ([[1, 18000], [3, 36000]] as [$station, $price]) {
            DB::table('gaming_sessions')->insert(['workstation_id' => $station, 'user_id' => 42, 'status' => 'completed', 'starts_at' => '2026-10-12T12:00:00Z', 'ends_at' => '2026-10-12T13:00:00Z', 'ended_at' => '2026-10-12T13:00:00Z', 'hourly_price' => 18000, 'total_price' => $price]);
        }
    }

    public function test_report_can_be_limited_to_one_zone(): void
    {
        $this->seedClub();
        $service = app(AdminReportService::class);
        $club = $service->report('2026-10-12', '2026-10-12');
        $arena = $service->report('2026-10-12', '2026-10-12', 1);
        $vip = $service->report('2026-10-12', '2026-10-12', 2);
        self::assertSame(2, $club['bookings']);
        self::assertSame(1, $arena['bookings']);
        self::assertSame(2, $vip['bookings']);
        self::assertSame(1, $vip['cancelled_bookings']);
        self::assertSame(54000, $club['earned_price']);
        self::assertSame(18000, $arena['earned_price']);
        self::assertSame(36000, $vip['earned_price']);
        self::assertSame(1.0, $arena['occupied_hours']);
        self::assertSame(1, $vip['completed_sessions']);
        self::assertSame(1, $arena['zone_id']);
        self::assertNull($club['zone_id']);
    }

    public function test_unknown_zone_is_rejected(): void
    {
        $this->seedClub();
        $this->expectException(ValidationException::class);
        app(AdminReportService::class)->report('2026-10-12', '2026-10-12', 99);
    }

    public function test_report_includes_site_funnel(): void
    {
        $this->seedClub();
        foreach ([['page_view', 'a'], ['page_view', 'a'], ['page_view', 'b'], ['booking_started', 'a']] as [$type, $visitor]) {
            DB::table('site_events')->insert(['type' => $type, 'path' => '/booking', 'visitor' => $visitor, 'environment' => 'testing', 'created_at' => '2026-10-12T10:00:00Z']);
        }
        $report = app(AdminReportService::class)->report('2026-10-12', '2026-10-12');
        self::assertSame(3, $report['site_page_views']);
        self::assertSame(1, $report['site_booking_started']);
        self::assertSame(2, $report['site_visits']);
        self::assertSame(0, $report['site_people_daily_sum']);
        DB::table('site_events')->update(['person' => 'p1']);
        DB::table('site_events')->where('visitor', 'b')->update(['person' => 'p2']);
        DB::table('site_events')->insert(['type' => 'page_view', 'path' => '/', 'visitor' => 'c', 'person' => 'p1', 'environment' => 'testing', 'created_at' => '2026-10-11T10:00:00Z']);
        $report = app(AdminReportService::class)->report('2026-10-11', '2026-10-12');
        self::assertSame(3, $report['site_people_daily_sum']);
    }

    public function test_daily_snapshots_are_built_once_and_missing_days_are_backfilled(): void
    {
        $this->seedClub();
        $this->artisan('reports:daily', ['--days' => 3])->assertSuccessful();
        self::assertSame(3, DB::table('daily_club_reports')->count());
        $this->artisan('reports:daily', ['--days' => 3])->assertSuccessful();
        self::assertSame(3, DB::table('daily_club_reports')->count());
        $row = json_decode((string) DB::table('daily_club_reports')->where('date', '2026-10-12')->value('payload'), true);
        self::assertSame(2, $row['club']['bookings']);
        self::assertSame(36000, $row['zones']['2']['earned_price']);
        DB::table('daily_club_reports')->where('date', '2026-10-11')->delete();
        $this->artisan('reports:daily', ['--days' => 3])->assertSuccessful();
        self::assertSame(3, DB::table('daily_club_reports')->count());
    }
}
