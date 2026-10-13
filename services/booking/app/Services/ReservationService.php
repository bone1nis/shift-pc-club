<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ReservationService
{
    /** @return array{0:CarbonImmutable,1:CarbonImmutable,2:int} */
    public function interval(string $start, string $end): array
    {
        $timezone = (string) config('shift.club_timezone', 'Europe/Moscow');
        $s = CarbonImmutable::parse($start, $timezone)->utc();
        $e = CarbonImmutable::parse($end, $timezone)->utc();
        $minutes = (int) $s->diffInMinutes($e, false);
        $step = max(1, (int) config('shift.booking_step_minutes'));
        $max = (int) config('shift.booking_max_minutes');
        if ($minutes < $step || $minutes > $max || $minutes % $step !== 0 || $s->second !== 0 || $e->second !== 0 || $s->minute % $step !== 0 || $e->minute % $step !== 0) {
            throw ValidationException::withMessages(['ends_at' => sprintf('Интервал от %d минут до %s, с шагом %d минут.', $step, $max % 60 === 0 ? intdiv($max, 60).' ч' : $max.' мин', $step)]);
        }

        return [$s, $e, $minutes];
    }

    public static function price(int $hourlyPrice, int $minutes): int
    {
        return intdiv($hourlyPrice * $minutes + 59, 60);
    }

    /** @param list<int> $ids
     * @return Collection<int,\stdClass> */
    public function lockStations(array $ids, bool $checkPhysical = false): Collection
    {
        sort($ids);
        $stations = DB::table('workstations')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
        abort_unless($stations->count() === count($ids), 422, 'Unknown workstation.');
        foreach ($stations as $w) {
            abort_unless($w->status === 'available' && ! $w->maintenance_locked, 409, 'Место недоступно.');
            if ($checkPhysical) {
                abort_if(DB::table('gaming_sessions')->where('workstation_id', $w->id)->whereIn('status', ['active', 'awaiting_checkout'])->exists(), 409, 'Предыдущая сессия ещё не завершена администратором.');
            }
        }

        return $stations;
    }

    /** @return array<string,mixed> */
    public function booking(int $id): array
    {
        $b = DB::table('bookings')->where('id', $id)->first();
        abort_unless($b !== null, 404);
        $data = (array) $b;
        $data['items'] = DB::table('booking_items')->where('booking_id', $id)->orderBy('id')->get()->all();

        return $data;
    }

    /** @param list<int> $ids
     * @return array<string,mixed> */
    public function create(int $userId, array $ids, string $start, string $end, string $key, ?int $createdBy = null): array
    {
        [$s,$e,$minutes] = $this->interval($start, $end);
        sort($ids);
        $fingerprint = hash('sha256', json_encode([$ids, $s->toIso8601String(), $e->toIso8601String()], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($userId, $ids, $s, $e, $minutes, $key, $fingerprint, $createdBy): array {
            DB::statement('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$userId.':'.$key]);
            $previous = DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->first();
            if ($previous) {
                abort_unless(hash_equals($previous->fingerprint, $fingerprint), 409, 'Idempotency key used with a different request.');

                return $this->booking((int) $previous->booking_id);
            }
            if ($s->lt(now()) || $s->gt(now()->addDays((int) config('shift.booking_horizon_days')))) {
                throw ValidationException::withMessages(['starts_at' => sprintf('Выберите время в ближайшие %d дн.', (int) config('shift.booking_horizon_days'))]);
            }
            $stations = $this->lockStations($ids);
            $total = 0;
            foreach ($stations as $w) {
                $total += self::price((int) $w->hourly_price, $minutes);
            }
            $id = DB::table('bookings')->insertGetId(['user_id' => $userId, 'status' => 'confirmed', 'starts_at' => $s, 'ends_at' => $e, 'total_price' => $total, 'created_at' => now(), 'updated_at' => now()]);
            foreach ($stations as $w) {
                DB::table('booking_items')->insert(['booking_id' => $id, 'workstation_id' => $w->id, 'hourly_price' => $w->hourly_price, 'price' => self::price((int) $w->hourly_price, $minutes), 'catalog_version' => $w->version]);
                DB::table('allocations')->insert(['workstation_id' => $w->id, 'booking_id' => $id, 'starts_at' => $s, 'ends_at' => $e, 'active' => true]);
            }
            DB::table('idempotency_keys')->insert(['user_id' => $userId, 'key' => $key, 'fingerprint' => $fingerprint, 'booking_id' => $id]);
            Outbox::record('booking.confirmed', ['booking_id' => $id, 'user_id' => $userId]);
            if ($createdBy !== null) {
                self::audit($createdBy, 'booking.created_by_admin', $id, ['user_id' => $userId]);
            }

            return $this->booking($id);
        });
    }

    public function cancel(int $id, int $userId, bool $admin = false): void
    {
        DB::transaction(function () use ($id, $userId, $admin): void {
            $b = DB::table('bookings')->where('id', $id)->lockForUpdate()->first();
            abort_unless($b !== null, 404);
            abort_unless($admin || (int) $b->user_id === $userId, 404);
            if ($b->status === 'cancelled') {
                return;
            }
            abort_unless($b->status === 'confirmed' && ($admin || now()->lt($b->starts_at)), 409, 'Эту бронь уже нельзя отменить.');
            DB::table('bookings')->where('id', $id)->update(['status' => 'cancelled', 'updated_at' => now()]);
            DB::table('allocations')->where('booking_id', $id)->update(['active' => false]);
            self::audit($userId, 'booking.cancelled', $id, []);
            Outbox::record('booking.cancelled', ['booking_id' => $id, 'user_id' => (int) $b->user_id]);
        });
    }

    /** @param array<string,mixed> $changes */
    public static function audit(int $actor, string $action, int $entity, array $changes): void
    {
        Log::info(self::auditMessage($action, $entity, $changes), ['event' => 'audit.'.$action, 'actor_id' => $actor, 'entity_id' => $entity]);
        DB::table('audit_entries')->insert(['actor_id' => $actor, 'action' => $action, 'entity_id' => $entity, 'changes' => json_encode($changes, JSON_THROW_ON_ERROR), 'created_at' => now()]);
    }

    /** @param array<string,mixed> $changes */
    private static function auditMessage(string $action, int $entity, array $changes): string
    {
        return match ($action) {
            'booking.created_by_admin' => "Администратор создал бронь №{$entity}",
            'booking.cancelled' => "Бронь №{$entity} отменена",
            'booking.checked_in' => "Бронь №{$entity} заселена",
            'session.started' => "Запущена сессия №{$entity}",
            'session.completed' => "Сессия №{$entity} завершена",
            'session.extended' => "Сессия №{$entity} продлена на ".($changes['minutes'] ?? '?').' мин',
            'session.paid' => "Оплата сессии №{$entity} отмечена",
            'session.moved' => "Сессия №{$entity} пересажена: место ".($changes['from'] ?? '?').' → '.($changes['to'] ?? '?'),
            default => "Действие {$action} (№{$entity})",
        };
    }
}
