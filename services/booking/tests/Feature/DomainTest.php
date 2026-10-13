<?php

namespace Tests\Feature;

use App\Jobs\SendNotificationEmail;
use App\Services\CatalogProjection;
use App\Services\EventHandler;
use App\Services\ReservationService;
use App\Services\SessionService;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class DomainTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-12T10:00:00Z'));
        foreach ([1, 2, 3] as $id) {
            DB::table('workstations')->insert(['id' => $id, 'zone_id' => 1, 'name' => 'PC-'.$id, 'status' => 'available', 'version' => 1, 'hourly_price' => 18000, 'synced_at' => now()]);
        }
    }

    private function book(array $ids, string $start = '2026-10-12T11:00:00Z', string $end = '2026-10-12T12:00:00Z', ?string $key = null): array
    {
        return app(ReservationService::class)->create(42, $ids, $start, $end, $key ?? (string) Str::uuid());
    }

    public function test_price_snapshot_idempotency_and_half_open_intervals(): void
    {
        $key = (string) Str::uuid();
        $b = $this->book([1, 2], key: $key);
        self::assertSame(36000, $b['total_price']);
        self::assertSame($b['id'], $this->book([2, 1], key: $key)['id']);
        DB::table('workstations')->update(['hourly_price' => 28000]);
        self::assertSame(18000, app(ReservationService::class)->booking($b['id'])['items'][0]->hourly_price);
        $next = $this->book([1], '2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z');
        self::assertSame(28000, $next['total_price']);
    }

    public function test_naive_booking_times_use_club_timezone_and_explicit_offsets_are_preserved(): void
    {
        $local = $this->book([1], '2026-10-12T14:00:00', '2026-10-12T15:00:00');
        $explicitUtc = $this->book([2], '2026-10-12T11:00:00Z', '2026-10-12T12:00:00Z');

        self::assertSame($explicitUtc['starts_at'], $local['starts_at']);
        self::assertSame($explicitUtc['ends_at'], $local['ends_at']);
    }

    public function test_group_conflict_rolls_back_all_items_and_outbox(): void
    {
        $this->book([2]);
        try {
            $this->book([1, 2]);
            self::fail('Expected conflict');
        } catch (QueryException $e) {
            self::assertSame('23P01', $e->errorInfo[0]);
        }self::assertSame(1, DB::table('bookings')->count());
        self::assertSame(1, DB::table('allocations')->count());
        self::assertSame(1, DB::table('outbox')->count());
    }

    public function test_changed_idempotent_payload_fails(): void
    {
        $key = (string) Str::uuid();
        $this->book([1], key: $key);
        $this->expectException(HttpException::class);
        $this->book([2], key: $key);
    }

    public function test_cancel_frees_capacity_and_is_idempotent(): void
    {
        $b = $this->book([1]);
        app(ReservationService::class)->cancel($b['id'], 42);
        app(ReservationService::class)->cancel($b['id'], 42);
        self::assertSame('cancelled', app(ReservationService::class)->booking($b['id'])['status']);
        $this->book([1]);
        self::assertSame(1, DB::table('allocations')->where('active', true)->count());
    }

    public function test_owner_cannot_cancel_another_booking(): void
    {
        $b = $this->book([1]);
        $this->expectException(NotFoundHttpException::class);
        app(ReservationService::class)->cancel($b['id'], 99);
    }

    public function test_checkin_extend_and_move_share_overlap_constraint(): void
    {
        $b = $this->book([1]);
        $this->book([1], '2026-10-12T12:00:00Z', '2026-10-12T13:00:00Z');
        $this->travelTo(CarbonImmutable::parse('2026-10-12T10:50:00Z'));
        $s = app(SessionService::class)->checkIn($b['id'], 1)[0];
        self::assertSame(2, DB::table('allocations')->where('active', true)->count());
        try {
            app(SessionService::class)->extend($s->id, 30, 1);
            self::fail('Expected conflict');
        } catch (QueryException $e) {
            self::assertSame('23P01', $e->errorInfo[0]);
        }self::assertSame($s->ends_at, app(SessionService::class)->session($s->id)->ends_at);
        $moved = app(SessionService::class)->move($s->id, 2, 1);
        self::assertSame(2, $moved->workstation_id);
        $extended = app(SessionService::class)->extend($s->id, 30, 1);
        self::assertSame(27000, $extended->total_price);
        app(SessionService::class)->end($s->id, 1);
        self::assertSame('completed', app(SessionService::class)->session($s->id)->status);
    }

    public function test_check_in_is_rejected_after_no_show_grace_even_if_scheduler_is_stale(): void
    {
        $booking = $this->book([1]);
        $this->travelTo(CarbonImmutable::parse('2026-10-12T11:15:00Z'));

        $this->expectException(HttpException::class);
        app(SessionService::class)->checkIn($booking['id'], 1);
    }

    public function test_reconcile_no_show_without_physical_release(): void
    {
        $b = $this->book([1]);
        $s = app(SessionService::class)->guest(2, 30, 1);
        $this->travel(90)->minutes();
        $this->artisan('club:reconcile')->assertSuccessful();
        self::assertSame('no_show', app(ReservationService::class)->booking($b['id'])['status']);
        self::assertSame('awaiting_checkout', app(SessionService::class)->session($s->id)->status);
        self::assertTrue(DB::table('allocations')->where('session_id', $s->id)->value('active'));
    }

    public function test_duplicate_event_creates_one_notification(): void
    {
        $this->book([1]);
        $event = json_decode(DB::table('outbox')->value('payload'), true);
        app(EventHandler::class)->process($event);
        app(EventHandler::class)->process($event);
        self::assertSame(1, DB::table('notifications')->count());
        self::assertSame(1, DB::table('inbox')->count());
    }

    public function test_maintenance_prevents_booking(): void
    {
        DB::table('workstations')->where('id', 1)->update(['maintenance_locked' => true]);
        $this->expectException(HttpException::class);
        $this->book([1]);
    }

    public function test_independent_postgres_processes_allow_one_winner(): void
    {
        self::assertTrue(function_exists('pcntl_fork'));
        $dir = sys_get_temp_dir().'/shift-race-'.Str::uuid();
        mkdir($dir);
        DB::disconnect();
        $children = [];
        for ($i = 0; $i < 2; $i++) {
            $pid = pcntl_fork();
            self::assertNotSame(-1, $pid);
            if ($pid === 0) {
                DB::purge();
                while (! file_exists($dir.'/go')) {
                    usleep(1000);
                }try {
                    $this->book([1]);
                    file_put_contents($dir.'/'.$i, 'created');
                } catch (QueryException $e) {
                    file_put_contents($dir.'/'.$i, $e->errorInfo[0]);
                } catch (\Throwable $e) {
                    file_put_contents($dir.'/'.$i, $e::class);
                }exit(0);
            }$children[] = $pid;
        }
        touch($dir.'/go');
        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
            self::assertSame(0, pcntl_wexitstatus($status));
        }$results = [file_get_contents($dir.'/0'), file_get_contents($dir.'/1')];
        sort($results);
        self::assertSame(['23P01', 'created'], $results);
        self::assertSame(1, DB::table('bookings')->count());
        foreach (glob($dir.'/*') as $file) {
            unlink($file);
        }rmdir($dir);
    }

    public function test_stale_tariff_snapshot_cannot_regress_price(): void
    {
        $snapshot = ['zones' => [], 'workstations' => [['id' => 1, 'zone_id' => 1, 'name' => 'PC-1', 'status' => 'available', 'version' => 1]], 'tariffs' => [['id' => 1, 'zone_id' => 1, 'hourly_price' => 28000, 'version' => 2]]];
        Http::fake([config('shift.club_url').'/*' => Http::sequence()->push(['data' => $snapshot])->push(['data' => array_replace($snapshot, ['tariffs' => [['id' => 1, 'zone_id' => 1, 'hourly_price' => 18000, 'version' => 1]]])])]);
        app(CatalogProjection::class)->sync();
        app(CatalogProjection::class)->sync();
        self::assertSame(28000, DB::table('workstations')->where('id', 1)->value('hourly_price'));
    }

    public function test_reconcile_queues_reminder_email_once(): void
    {
        Queue::fake();
        $b = $this->book([1]);
        $this->travel(30)->minutes();
        $this->artisan('club:reconcile')->assertSuccessful();
        $this->artisan('club:reconcile')->assertSuccessful();
        self::assertSame(1, DB::table('notifications')->where('type', 'booking.reminder')->where('user_id', 42)->count());
        Queue::assertPushed(SendNotificationEmail::class, 1);
        self::assertSame('confirmed', app(ReservationService::class)->booking($b['id'])['status']);
    }
}
