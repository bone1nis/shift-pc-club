<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendNotificationEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    /** @var list<int> */
    public array $backoff = [10, 60];

    public function __construct(public int $notificationId) {}

    public function handle(): void
    {
        $n = DB::table('notifications')->where('id', $this->notificationId)->first();
        if ($n === null || $n->delivery_status === 'sent') {
            return;
        }
        DB::table('notifications')->where('id', $n->id)->update(['delivery_attempts' => $n->delivery_attempts + 1]);
        $response = Http::timeout(5)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])
            ->get(config('shift.identity_url').'/api/auth/internal/users/'.$n->user_id);
        if ($response->status() === 404) {
            DB::table('notifications')->where('id', $n->id)->update(['delivery_status' => 'skipped', 'delivery_error' => 'Пользователь недоступен.']);

            return;
        }
        $user = $response->throw()->json('data');
        Mail::raw(self::text($n->type), function ($message) use ($user, $n): void {
            $message->to($user['email'])->subject(self::subject($n->type));
        });
        DB::table('notifications')->where('id', $n->id)->update(['delivery_status' => 'sent', 'delivery_error' => null, 'sent_at' => now()]);
        Log::info("Письмо отправлено: уведомление №{$n->id}", ['event' => 'notification.sent', 'notification_id' => (int) $n->id, 'type' => $n->type, 'attempt' => $n->delivery_attempts + 1]);
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning("Письмо не отправлено: уведомление №{$this->notificationId}", ['event' => 'notification.failed', 'notification_id' => $this->notificationId, 'exception_class' => $exception === null ? null : $exception::class]);
        DB::table('notifications')->where('id', $this->notificationId)->update(['delivery_status' => 'failed', 'delivery_error' => 'Не удалось отправить письмо.']);
    }

    public static function subject(string $type): string
    {
        return match ($type) {
            'booking.confirmed' => 'SHIFT: бронь подтверждена',
            'booking.cancelled' => 'SHIFT: бронь отменена',
            'booking.reminder' => 'SHIFT: напоминание о визите',
            'booking.no_show' => 'SHIFT: бронь освобождена из-за неявки',
            'session.ending' => 'SHIFT: время сессии скоро закончится',
            default => 'SHIFT: уведомление',
        };
    }

    public static function text(string $type): string
    {
        return self::subject($type).". Подробности — в личном кабинете SHIFT.\n";
    }
}
