<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminReportService
{
    /**
     * Показатели клуба за период в часовом поясе клуба; `$zoneId` ограничивает брони, сессии и загрузку одной зоной.
     *
     * @return array<string, mixed>
     */
    public function report(?string $from = null, ?string $to = null, ?int $zoneId = null): array
    {
        $timezone = (string) config('shift.club_timezone', 'Europe/Moscow');
        $last = $to === null ? CarbonImmutable::now($timezone)->startOfDay()
            : CarbonImmutable::createFromFormat('!Y-m-d', $to, $timezone);
        if ($last === null) {
            throw ValidationException::withMessages(['to' => 'Укажите корректную дату.']);
        }
        $first = $from === null ? $last->startOfMonth()
            : CarbonImmutable::createFromFormat('!Y-m-d', $from, $timezone);
        if ($first === null || $first->gt($last) || $first->diffInDays($last) > 365) {
            throw ValidationException::withMessages(['from' => 'Выберите период от 1 до 366 дней.']);
        }
        if ($zoneId !== null && ! DB::table('workstations')->where('zone_id', $zoneId)->exists()) {
            throw ValidationException::withMessages(['zone_id' => 'В этой зоне нет компьютеров.']);
        }
        $start = $first->utc();
        $end = $last->addDay()->utc();
        $now = CarbonImmutable::now()->utc();
        $cutoff = $end->min($now);

        $inZone = fn (Builder $query, string $column): Builder => $zoneId === null
            ? $query
            : $query->whereIn($column, DB::table('workstations')->where('zone_id', $zoneId)->select('id'));
        $bookings = DB::table('bookings')->where('starts_at', '>=', $start)->where('starts_at', '<', $end);
        if ($zoneId !== null) {
            $bookings->whereExists(fn (Builder $q) => $q->from('booking_items')
                ->join('workstations', 'workstations.id', '=', 'booking_items.workstation_id')
                ->whereColumn('booking_items.booking_id', 'bookings.id')->where('workstations.zone_id', $zoneId));
        }
        $sessions = fn (): Builder => $inZone(DB::table('gaming_sessions'), 'workstation_id');
        $completed = $sessions()->where('status', 'completed')->where('ended_at', '>=', $start)->where('ended_at', '<', $end);
        $occupied = $sessions()->where('starts_at', '<', $cutoff)
            ->whereRaw('COALESCE(ended_at, ?) > ?', [$now, $start])
            ->selectRaw('COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at, ?), ?) - GREATEST(starts_at, ?))))), 0) AS seconds', [$now, $cutoff, $start])
            ->first();
        $seconds = (float) ($occupied->seconds ?? 0);
        $stations = $zoneId === null ? DB::table('workstations')->count() : DB::table('workstations')->where('zone_id', $zoneId)->count();
        $capacity = $stations * max(0, $cutoff->getTimestamp() - $start->getTimestamp());
        $events = DB::table('site_events')->where('created_at', '>=', $start)->where('created_at', '<', $end);

        return [
            'from' => $first->format('Y-m-d'),
            'to' => $last->format('Y-m-d'),
            'timezone' => $timezone,
            'zone_id' => $zoneId,
            'bookings' => (clone $bookings)->count(),
            'confirmed_bookings' => (clone $bookings)->where('status', 'confirmed')->count(),
            'cancelled_bookings' => (clone $bookings)->where('status', 'cancelled')->count(),
            'no_show_bookings' => (clone $bookings)->where('status', 'no_show')->count(),
            'completed_sessions' => (clone $completed)->count(),
            'active_sessions' => $sessions()->whereIn('status', ['active', 'awaiting_checkout'])->count(),
            'earned_price' => (int) (clone $completed)->sum('total_price'),
            'paid_price' => (int) $sessions()->where('status', 'completed')
                ->where('paid_at', '>=', $start)->where('paid_at', '<', $end)->sum('total_price'),
            'occupied_hours' => round($seconds / 3600, 2),
            'occupancy_percent' => $capacity > 0 ? round(100 * $seconds / $capacity, 2) : 0,
            'outbox_pending' => DB::table('outbox')->whereNull('published_at')->count(),
            // Статистика сайта общая для клуба: просмотры, начало бронирования и число уникальных вкладок (не людей).
            'site_page_views' => (clone $events)->where('type', 'page_view')->count(),
            'site_booking_started' => (clone $events)->where('type', 'booking_started')->count(),
            'site_visits' => (clone $events)->distinct()->count('visitor'),
            // Сумма «уникальных людей за день» по дням периода: один человек в разные дни считается заново.
            'site_people_daily_sum' => (int) DB::query()->fromSub(
                (clone $events)->whereNotNull('person')->selectRaw("DATE(created_at AT TIME ZONE 'UTC') AS day, person")->distinct(),
                'people',
            )->count(),
        ];
    }
}
