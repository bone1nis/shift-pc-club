<?php

namespace Tests\Feature;

use App\Services\AdminReportService;
use App\Services\SessionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class SessionPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function createGuestSession(): \stdClass
    {
        DB::table('workstations')->insert(['id' => 1, 'zone_id' => 1, 'name' => 'PC-1', 'status' => 'available', 'version' => 1, 'hourly_price' => 18000, 'synced_at' => now()]);

        return app(SessionService::class)->guest(1, 60, 1);
    }

    public function test_payment_is_idempotent_audited_and_reported_on_payment_date(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-12T19:00:00Z'));
        $session = $this->createGuestSession();
        $this->travelTo(CarbonImmutable::parse('2026-10-12T20:00:00Z'));
        app(SessionService::class)->end($session->id, 1);
        $this->travelTo(CarbonImmutable::parse('2026-10-13T00:00:00Z'));
        $paid = app(SessionService::class)->pay($session->id, 1);
        self::assertNotNull($paid->paid_at);
        self::assertSame($paid->paid_at, app(SessionService::class)->pay($session->id, 1)->paid_at);
        self::assertSame(1, DB::table('audit_entries')->where('action', 'session.paid')->count());
        $reports = app(AdminReportService::class);
        self::assertSame(18000, $reports->report('2026-10-12', '2026-10-12')['earned_price']);
        self::assertSame(0, $reports->report('2026-10-12', '2026-10-12')['paid_price']);
        self::assertSame(18000, $reports->report('2026-10-13', '2026-10-13')['paid_price']);
        self::assertSame(0, $reports->report('2026-10-13', '2026-10-13')['earned_price']);
    }

    public function test_active_session_cannot_be_marked_paid(): void
    {
        $session = $this->createGuestSession();
        try {
            app(SessionService::class)->pay($session->id, 1);
            self::fail('Active session must not be marked paid.');
        } catch (HttpException $exception) {
            self::assertSame(409, $exception->getStatusCode());
        }
        self::assertNull(DB::table('gaming_sessions')->where('id', $session->id)->value('paid_at'));
    }
}
