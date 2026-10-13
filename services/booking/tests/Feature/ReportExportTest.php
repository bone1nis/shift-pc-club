<?php

namespace Tests\Feature;

use App\Http\Controllers\ReportExportController;
use App\Jobs\GenerateReportExport;
use App\Services\AdminReportService;
use App\Services\ReportCsvBuilder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ReportExportTest extends TestCase
{
    use DatabaseMigrations;

    private function request(int $userId): Request
    {
        $request = Request::create('/api/booking/admin/report-exports', 'POST', ['from' => '2026-10-12', 'to' => '2026-10-12']);
        $request->attributes->set('actor', ['id' => $userId, 'role' => 'admin']);

        return $request;
    }

    public function test_export_is_queued_generated_privately_and_repeated_delivery_is_safe(): void
    {
        Queue::fake();
        Storage::fake('local');
        $controller = app(ReportExportController::class);
        $response = $controller->store($this->request(1), app(AdminReportService::class));
        self::assertSame(202, $response->status());
        $id = $response->getData(true)['data']['id'];
        Queue::assertPushedOn('reports', GenerateReportExport::class);
        $job = new GenerateReportExport($id);
        $job->handle(app(ReportCsvBuilder::class));
        $first = Storage::disk('local')->get('reports/'.$id.'.csv');
        self::assertStringStartsWith("\xEF\xBB\xBF", $first);
        self::assertStringContainsString('Отчёт по клубу SHIFT', $first);
        self::assertStringContainsString('Период;"12.10.2026 — 12.10.2026"', $first);
        self::assertStringContainsString('СВОДКА ЗА ПЕРИОД', $first);
        self::assertStringContainsString('"Начислено за завершённые сессии";0,00;₽', $first);
        self::assertStringContainsString('ПО ДНЯМ', $first);
        self::assertStringContainsString("\n12.10.2026;0;0;0;0;0;0,00;0,00;0;0;0;0", $first);
        self::assertStringContainsString('ПО ЗОНАМ ЗА ПЕРИОД', $first);
        $job->handle(app(ReportCsvBuilder::class));
        self::assertSame($first, Storage::disk('local')->get('reports/'.$id.'.csv'));
        self::assertSame('ready', DB::table('report_exports')->where('id', $id)->value('status'));
        self::assertCount(0, $controller->index($this->request(2))->getData(true)['data']);
        $this->expectException(HttpException::class);
        $controller->download($this->request(2), $id);
    }

    public function test_export_routes_require_authentication(): void
    {
        $this->getJson('/api/booking/admin/report-exports')->assertUnauthorized();
        $this->postJson('/api/booking/admin/report-exports', ['from' => '2026-10-12'])->assertUnauthorized();
    }

    public function test_expired_export_is_gone_and_pruned(): void
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        Storage::disk('local')->put('reports/'.$id.'.csv', 'x');
        $old = now()->subHours(25);
        DB::table('report_exports')->insert(['id' => $id, 'user_id' => 1, 'from' => '2026-10-12', 'to' => '2026-10-12', 'status' => 'ready', 'path' => 'reports/'.$id.'.csv', 'created_at' => $old, 'updated_at' => $old]);
        try {
            app(ReportExportController::class)->download($this->request(1), $id);
            self::fail('Expected 410');
        } catch (HttpException $e) {
            self::assertSame(410, $e->getStatusCode());
        }
        $this->artisan('reports:prune')->assertSuccessful();
        self::assertSame('expired', DB::table('report_exports')->where('id', $id)->value('status'));
        Storage::disk('local')->assertMissing('reports/'.$id.'.csv');
    }

    public function test_stuck_exports_are_failed_by_the_pruner(): void
    {
        $stuck = (string) Str::uuid();
        $fresh = (string) Str::uuid();
        foreach ([[$stuck, 'pending', now()->subMinutes(20)], [$fresh, 'pending', now()->subMinutes(2)]] as [$id, $status, $at]) {
            DB::table('report_exports')->insert(['id' => $id, 'user_id' => 1, 'from' => '2026-10-12', 'to' => '2026-10-12', 'status' => $status, 'created_at' => $at, 'updated_at' => $at]);
        }
        $this->artisan('reports:prune')->assertSuccessful();
        self::assertSame('failed', DB::table('report_exports')->where('id', $stuck)->value('status'));
        self::assertSame('pending', DB::table('report_exports')->where('id', $fresh)->value('status'));
    }

    public function test_export_remembers_the_zone_filter_and_puts_it_in_the_csv(): void
    {
        Queue::fake();
        Storage::fake('local');
        DB::table('workstations')->insert(['id' => 1, 'zone_id' => 2, 'name' => 'VIP-1', 'status' => 'available', 'version' => 1, 'hourly_price' => 28000, 'synced_at' => now()]);
        $request = Request::create('/api/booking/admin/report-exports', 'POST', ['from' => '2026-10-12', 'to' => '2026-10-12', 'zone_id' => 2]);
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);
        $id = app(ReportExportController::class)->store($request, app(AdminReportService::class))->getData(true)['data']['id'];
        self::assertSame(2, (int) DB::table('report_exports')->where('id', $id)->value('zone_id'));
        (new GenerateReportExport($id))->handle(app(ReportCsvBuilder::class));
        $csv = Storage::disk('local')->get('reports/'.$id.'.csv');
        self::assertStringContainsString('Охват;"зона №2"', $csv);
        self::assertStringNotContainsString('ПО ЗОНАМ', $csv);
    }
}
