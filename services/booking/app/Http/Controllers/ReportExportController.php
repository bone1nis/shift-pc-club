<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateReportExport;
use App\Services\AdminReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportController extends Controller
{
    public function store(Request $request, AdminReportService $reports): JsonResponse
    {
        $values = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d', 'zone_id' => 'nullable|integer|min:1']);
        $zone = isset($values['zone_id']) ? (int) $values['zone_id'] : null;
        $report = $reports->report($values['from'] ?? null, $values['to'] ?? null, $zone);
        $id = (string) Str::uuid();
        DB::transaction(function () use ($request, $report, $id, $zone): void {
            DB::table('report_exports')->insert(['id' => $id, 'user_id' => (int) $request->attributes->get('actor')['id'], 'from' => $report['from'], 'to' => $report['to'], 'zone_id' => $zone, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
            GenerateReportExport::dispatch($id)->onConnection('database')->onQueue('reports')->afterCommit();
        });

        return response()->json(['data' => ['id' => $id, 'status' => 'pending']], 202);
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => DB::table('report_exports')->where('user_id', $request->attributes->get('actor')['id'])->orderByDesc('created_at')->limit(30)->get(['id', 'from', 'to', 'zone_id', 'status', 'error', 'created_at', 'updated_at'])]);
    }

    public function download(Request $request, string $id): StreamedResponse
    {
        $export = DB::table('report_exports')->where('id', $id)->where('user_id', $request->attributes->get('actor')['id'])->first();
        abort_unless($export !== null, 404);
        abort_if($export->status === 'expired' || ($export->status === 'ready' && now()->subHours((int) config('shift.export_ttl_hours'))->gt($export->updated_at)), 410, 'Срок хранения выгрузки истёк.');
        abort_unless($export->status === 'ready' && $export->path !== null && Storage::disk('local')->exists($export->path), 409, 'Выгрузка ещё не готова.');

        return Storage::disk('local')->download($export->path, 'club-report-'.$export->from.'-'.$export->to.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
    }
}
