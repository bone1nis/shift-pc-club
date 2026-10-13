<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class CatalogProjection
{
    public function sync(): void
    {
        $response = Http::timeout(5)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])->get(config('shift.club_url').'/api/club/internal/catalog');
        if (! $response->successful()) {
            throw new \RuntimeException('Club snapshot unavailable.');
        }
        $catalog = $response->json('data');
        DB::transaction(function () use ($catalog): void {
            $prices = [];
            foreach ($catalog['tariffs'] as $tariff) {
                $prices[$tariff['zone_id']] = $tariff;
            }
            $stations = $catalog['workstations'];
            usort($stations, fn ($a, $b) => $a['id'] <=> $b['id']);
            foreach ($stations as $w) {
                DB::table('workstations')->insertOrIgnore(['id' => $w['id'], 'zone_id' => $w['zone_id'], 'name' => $w['name'], 'status' => $w['status'], 'version' => $w['version'], 'hourly_price' => $prices[$w['zone_id']]['hourly_price'], 'synced_at' => now()]);
                DB::table('workstations')->where('id', $w['id'])->lockForUpdate()->first();
                DB::table('workstations')->where('id', $w['id'])->where('version', '<=', $w['version'])->update(['zone_id' => $w['zone_id'], 'name' => $w['name'], 'status' => $w['status'], 'version' => $w['version'], 'synced_at' => now()]);
                $tariff = $prices[$w['zone_id']];
                DB::table('workstations')->where('id', $w['id'])->where('zone_id', $w['zone_id'])->where('tariff_version', '<=', $tariff['version'])->update(['hourly_price' => $tariff['hourly_price'], 'tariff_version' => $tariff['version']]);
            }
        });
    }

    public function ensureFresh(): void
    {
        try {
            $this->sync();
        } catch (\Throwable $e) {
            abort(503, 'Catalog unavailable; retry later.');
        }
    }
}
