<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class SessionService
{
    public function __construct(private ReservationService $reservations) {}

    /** @return array<int,\stdClass> */
    public function checkIn(int $bookingId, int $actor): array
    {
        return DB::transaction(function () use ($bookingId, $actor): array {
            $b = DB::table('bookings')->where('id', $bookingId)->lockForUpdate()->first();
            abort_unless($b !== null, 404);
            if ($b->status === 'checked_in') {
                return DB::table('gaming_sessions')->where('booking_id', $bookingId)->get()->all();
            }
            $startsAt = CarbonImmutable::parse($b->starts_at);
            abort_unless($b->status === 'confirmed' && now()->gte($startsAt->subMinutes((int) config('shift.checkin_early_minutes'))) && now()->lt($startsAt->addMinutes((int) config('shift.no_show_grace_minutes'))), 409, sprintf('Заселение доступно за %d мин до начала и до %d мин после старта.', (int) config('shift.checkin_early_minutes'), (int) config('shift.no_show_grace_minutes')));
            $items = DB::table('booking_items')->where('booking_id', $bookingId)->get();
            $ids = $items->pluck('workstation_id')->map(fn ($id) => (int) $id)->values()->all();
            $this->reservations->lockStations(array_values($ids), true);
            DB::table('allocations')->where('booking_id', $bookingId)->update(['active' => false]);
            foreach ($items as $item) {
                $this->start((int) $item->workstation_id, (int) $b->user_id, $bookingId, now()->toIso8601String(), $b->ends_at, (int) $item->hourly_price, (int) $item->price);
            }
            DB::table('bookings')->where('id', $bookingId)->update(['status' => 'checked_in', 'updated_at' => now()]);
            ReservationService::audit($actor, 'booking.checked_in', $bookingId, []);
            Outbox::record('booking.checked_in', ['booking_id' => $bookingId, 'user_id' => (int) $b->user_id]);

            return DB::table('gaming_sessions')->where('booking_id', $bookingId)->get()->all();
        });
    }

    public function guest(int $workstationId, int $minutes, int $actor): \stdClass
    {
        return DB::transaction(function () use ($workstationId, $minutes, $actor): \stdClass {
            $w = $this->reservations->lockStations([$workstationId], true)->first();
            assert($w !== null);
            $id = $this->start($workstationId, null, null, now()->toIso8601String(), now()->addMinutes($minutes)->toIso8601String(), (int) $w->hourly_price, ReservationService::price((int) $w->hourly_price, $minutes));
            ReservationService::audit($actor, 'session.started', $id, ['workstation_id' => $workstationId]);

            return $this->session($id);
        });
    }

    private function start(int $workstationId, ?int $userId, ?int $bookingId, string $start, string $end, int $hourlyPrice, int $price): int
    {
        $id = DB::table('gaming_sessions')->insertGetId(['workstation_id' => $workstationId, 'user_id' => $userId, 'booking_id' => $bookingId, 'starts_at' => $start, 'ends_at' => $end, 'hourly_price' => $hourlyPrice, 'total_price' => $price, 'status' => 'active', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('allocations')->insert(['workstation_id' => $workstationId, 'session_id' => $id, 'starts_at' => $start, 'ends_at' => $end, 'active' => true]);

        return $id;
    }

    public function session(int $id): \stdClass
    {
        $s = DB::table('gaming_sessions')->where('id', $id)->first();
        abort_unless($s !== null, 404);

        return $s;
    }

    public function end(int $id, int $actor): \stdClass
    {
        return DB::transaction(function () use ($id, $actor): \stdClass {
            $s = DB::table('gaming_sessions')->where('id', $id)->lockForUpdate()->first();
            abort_unless($s !== null, 404);
            if ($s->status === 'completed') {
                return $s;
            }
            DB::table('workstations')->where('id', $s->workstation_id)->lockForUpdate()->first();
            DB::table('gaming_sessions')->where('id', $id)->update(['status' => 'completed', 'ended_at' => now(), 'updated_at' => now(), 'version' => $s->version + 1]);
            DB::table('allocations')->where('session_id', $id)->update(['active' => false]);
            ReservationService::audit($actor, 'session.completed', $id, []);
            Outbox::record('session.completed', ['session_id' => $id, 'user_id' => $s->user_id]);

            return $this->session($id);
        });
    }

    public function extend(int $id, int $minutes, int $actor): \stdClass
    {
        return DB::transaction(function () use ($id, $minutes, $actor): \stdClass {
            $s = DB::table('gaming_sessions')->where('id', $id)->lockForUpdate()->first();
            abort_unless($s !== null, 404);
            abort_unless($s->status === 'active' && now()->lt($s->ends_at), 409, 'Сессию уже нельзя продлить.');
            $this->reservations->lockStations([(int) $s->workstation_id]);
            $end = CarbonImmutable::parse($s->ends_at)->addMinutes($minutes);
            $total = $s->total_price + ReservationService::price((int) $s->hourly_price, $minutes);
            DB::table('allocations')->where('session_id', $id)->where('active', true)->update(['ends_at' => $end]);
            DB::table('gaming_sessions')->where('id', $id)->update(['ends_at' => $end, 'total_price' => $total, 'version' => $s->version + 1, 'updated_at' => now()]);
            ReservationService::audit($actor, 'session.extended', $id, ['minutes' => $minutes]);

            return $this->session($id);
        });
    }

    public function pay(int $id, int $actor): \stdClass
    {
        return DB::transaction(function () use ($id, $actor): \stdClass {
            $session = DB::table('gaming_sessions')->where('id', $id)->lockForUpdate()->first();
            abort_unless($session !== null, 404);
            abort_unless($session->status === 'completed', 409, 'Сначала завершите сессию.');
            if ($session->paid_at !== null) {
                return $session;
            }
            DB::table('gaming_sessions')->where('id', $id)->update(['paid_at' => now(), 'updated_at' => now(), 'version' => $session->version + 1]);
            ReservationService::audit($actor, 'session.paid', $id, ['amount' => (int) $session->total_price]);

            return $this->session($id);
        });
    }

    public function move(int $id, int $stationId, int $actor): \stdClass
    {
        return DB::transaction(function () use ($id, $stationId, $actor): \stdClass {
            $s = DB::table('gaming_sessions')->where('id', $id)->lockForUpdate()->first();
            abort_unless($s !== null, 404);
            abort_unless($s->status === 'active' && now()->lt($s->ends_at), 409, 'Сессию уже нельзя пересадить.');
            if ((int) $s->workstation_id === $stationId) {
                return $s;
            }
            $this->reservations->lockStations([(int) $s->workstation_id, $stationId]);
            abort_if(DB::table('gaming_sessions')->where('workstation_id', $stationId)->whereIn('status', ['active', 'awaiting_checkout'])->exists(), 409, 'Место занято.');
            $target = DB::table('workstations')->where('id', $stationId)->first();
            $source = DB::table('workstations')->where('id', $s->workstation_id)->first();
            assert($target !== null && $source !== null);
            abort_unless((int) $target->zone_id === (int) $source->zone_id, 409, 'Пересадка разрешена в той же зоне с сохранением тарифа.');
            DB::table('allocations')->where('session_id', $id)->where('active', true)->update(['active' => false]);
            DB::table('allocations')->insert(['workstation_id' => $stationId, 'session_id' => $id, 'starts_at' => now(), 'ends_at' => $s->ends_at, 'active' => true]);
            DB::table('gaming_sessions')->where('id', $id)->update(['workstation_id' => $stationId, 'version' => $s->version + 1, 'updated_at' => now()]);
            ReservationService::audit($actor, 'session.moved', $id, ['from' => $s->workstation_id, 'to' => $stationId]);

            return $this->session($id);
        });
    }
}
