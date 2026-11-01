<?php

namespace App\Services;

use App\Events\Signal;
use App\Mail\ComplaintCreated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Обработка событий Booking и Club: проекция участников брони и сигналы в WebSocket.
 * Запись в inbox, проекция и рассылка выполняются в одной транзакции; ack отправляет консьюмер после неё.
 */
class EventHandler
{
    /**
     * @param  array<string,mixed>  $event
     * @return bool true, если событие обработано сейчас; false, если это повтор
     */
    public function process(array $event): bool
    {
        if (! is_string($event['event_id'] ?? null) || ! Str::isUuid($event['event_id']) || ($event['schema_version'] ?? null) !== 1 || ! is_string($event['type'] ?? null) || ! is_array($event['payload'] ?? null)) {
            throw new \InvalidArgumentException('Invalid event envelope.');
        }

        $processed = DB::transaction(function () use ($event): bool {
            // Уникальный ключ inbox делает обработку идемпотентной даже при гонке двух воркеров.
            if (DB::table('inbox')->insertOrIgnore(['event_id' => $event['event_id'], 'processed_at' => now()]) === 0) {
                return false;
            }
            $this->apply($event['type'], $event['payload']);

            return true;
        });

        // Письмо уходит строго после коммита inbox: повтор события его не дублирует.
        if ($processed && $event['type'] === 'complaint.created') {
            $this->mailOwners($this->int($event['payload']['id'] ?? null));
        }

        return $processed;
    }

    /** Письмо владельцам без текста жалобы; сбой не мешает обработке и не повторяется. */
    private function mailOwners(?int $complaint): void
    {
        if ($complaint === null) {
            return;
        }
        try {
            $response = Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])
                ->get(config('shift.identity_url').'/api/auth/internal/owners/emails');
            $emails = array_values(array_filter((array) $response->throw()->json('data.emails'), 'is_string'));
            if ($emails === []) {
                return;
            }
            Mail::to($emails)->send(new ComplaintCreated($complaint, rtrim((string) config('shift.origin'), '/').'/admin/complaints'));
            Log::info('Письмо о новой жалобе отправлено', ['event' => 'complaint.mail_sent', 'complaint_id' => $complaint, 'recipients' => count($emails)]);
        } catch (\Throwable $e) {
            Log::warning('Письмо о новой жалобе не отправлено', ['event' => 'complaint.mail_failed', 'complaint_id' => $complaint, 'exception_class' => $e::class]);
        }
    }

    /** @param array<string,mixed> $p */
    private function apply(string $type, array $p): void
    {
        $user = $this->int($p['user_id'] ?? null);
        $booking = $this->int($p['booking_id'] ?? null);
        $session = $this->int($p['session_id'] ?? null);
        $station = $this->int($p['workstation_id'] ?? null);

        switch ($type) {
            case 'booking.confirmed':
                if ($booking !== null && $user !== null) {
                    // Владелец брони — участник с ролью owner; повтор не меняет существующую запись.
                    DB::table('booking_participants')->insertOrIgnore(['booking_id' => $booking, 'user_id' => $user, 'role' => 'owner', 'created_at' => now(), 'updated_at' => now()]);
                }
                $this->account($user, 'booking', $booking);
                $this->hall('booking', $booking);
                break;
            case 'booking.cancelled':
            case 'booking.no_show':
                $this->close($booking);
                $this->account($user, 'booking', $booking);
                $this->hall('booking', $booking);
                break;
            case 'booking.checked_in':
                $this->account($user, 'booking', $booking);
                $this->hall('booking', $booking);
                break;
            case 'booking.reminder':
                $this->account($user, 'notification', $booking);
                break;
            case 'booking.maintenance_changed':
                $this->hall('workstation', $station);
                break;
            case 'session.completed':
                if (($p['booking_finished'] ?? false) === true) {
                    $this->close($booking);
                }
                // Без break: как и остальные события сессий, обновляет кабинет и зал.
            case 'session.started':
            case 'session.extended':
            case 'session.moved':
            case 'session.awaiting_checkout':
                $this->account($user, 'session', $session);
                $this->hall('session', $session);
                break;
            case 'session.ending':
                $this->account($user, 'notification', $session);
                break;
            case 'club.catalog.updated':
                $entity = is_string($p['entity'] ?? null) ? $p['entity'] : 'catalog';
                $this->hall($entity === 'workstations' ? 'workstation' : $entity, $this->int($p['id'] ?? null));
                break;
            case 'complaint.created':
                // Только сигнал владельцу (тип и id, без текста): жалоба зашифрована и читается в Club.
                $complaint = $this->int($p['id'] ?? null);
                if ($complaint !== null) {
                    Signal::dispatch('complaint.created', 'owner', 'complaint.created', $complaint);
                }
                break;
            default:
                Log::info('Событие без сигнала пропущено: '.$type, ['event' => 'event.ignored']);
        }
    }

    private function close(?int $booking): void
    {
        if ($booking !== null) {
            DB::table('booking_participants')->where('booking_id', $booking)->whereNull('closed_at')->update(['closed_at' => now(), 'updated_at' => now()]);
        }
    }

    private function account(?int $user, string $type, ?int $id): void
    {
        if ($user !== null && $id !== null) {
            Signal::dispatch('account.changed', 'user.'.$user, $type, $id);
        }
    }

    private function hall(string $type, ?int $id): void
    {
        if ($id !== null) {
            Signal::dispatch('hall.changed', 'hall', $type, $id);
        }
    }

    private function int(mixed $value): ?int
    {
        return is_int($value) && $value > 0 ? $value : null;
    }
}
