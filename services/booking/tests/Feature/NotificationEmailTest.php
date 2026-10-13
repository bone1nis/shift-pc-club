<?php

namespace Tests\Feature;

use App\Http\Controllers\BookingController;
use App\Jobs\SendNotificationEmail;
use App\Services\Broker;
use App\Services\EventHandler;
use App\Services\Outbox;
use App\Services\ReservationService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class NotificationEmailTest extends TestCase
{
    use DatabaseMigrations;

    private function notification(string $status = 'pending'): int
    {
        return DB::table('notifications')->insertGetId(['user_id' => 7, 'type' => 'booking.confirmed', 'dedupe_key' => uniqid('e', true), 'data' => '{}', 'created_at' => now(), 'delivery_status' => $status]);
    }

    private function booking(int $id): void
    {
        DB::table('bookings')->insert(['id' => $id, 'user_id' => 7, 'status' => 'confirmed', 'starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addHour(), 'total_price' => 18000, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_event_creates_one_notification_and_queues_one_email(): void
    {
        Queue::fake();
        $this->booking(1);
        $event = ['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => 'booking.confirmed', 'payload' => ['user_id' => 7, 'booking_id' => 1]];
        app(EventHandler::class)->process($event);
        app(EventHandler::class)->process($event);
        self::assertSame(1, DB::table('notifications')->count());
        Queue::assertPushed(SendNotificationEmail::class, 1);
        Queue::assertPushedOn('notifications', SendNotificationEmail::class);
    }

    public function test_event_for_a_missing_booking_creates_no_notification(): void
    {
        Queue::fake();
        foreach (['booking.confirmed', 'booking.cancelled', 'booking.no_show'] as $type) {
            app(EventHandler::class)->process(['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => $type, 'payload' => ['user_id' => 7, 'booking_id' => 999999]]);
        }
        self::assertSame(0, DB::table('notifications')->count());
        self::assertSame(3, DB::table('inbox')->count());
        Queue::assertNothingPushed();
    }

    public function test_email_is_sent_once_and_marked_sent(): void
    {
        Mail::fake();
        Http::fake(['*' => Http::response(['data' => ['id' => 7, 'email' => 'p@shift.local', 'name' => 'P', 'role' => 'player']])]);
        $id = $this->notification();
        (new SendNotificationEmail($id))->handle();
        (new SendNotificationEmail($id))->handle();
        $row = DB::table('notifications')->where('id', $id)->first();
        self::assertSame('sent', $row->delivery_status);
        self::assertSame(1, (int) $row->delivery_attempts);
        Http::assertSentCount(1);
    }

    public function test_unknown_user_is_skipped_and_exhausted_job_is_failed(): void
    {
        Mail::fake();
        Http::fake(['*' => Http::response([], 404)]);
        $id = $this->notification();
        (new SendNotificationEmail($id))->handle();
        self::assertSame('skipped', DB::table('notifications')->where('id', $id)->value('delivery_status'));
        $failed = $this->notification();
        (new SendNotificationEmail($failed))->failed(new \RuntimeException('smtp'));
        self::assertSame('failed', DB::table('notifications')->where('id', $failed)->value('delivery_status'));
    }

    public function test_admin_retry_only_for_failed_and_is_audited(): void
    {
        Queue::fake();
        $request = Request::create('/api/booking/admin/notifications/1/retry', 'POST');
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);
        $controller = app(BookingController::class);
        $failed = $this->notification('failed');
        $sent = $this->notification('sent');
        try {
            $controller->retryNotification($request, $sent);
            self::fail('Expected 409');
        } catch (HttpException $e) {
            self::assertSame(409, $e->getStatusCode());
        }
        self::assertSame(202, $controller->retryNotification($request, $failed)->status());
        self::assertSame('pending', DB::table('notifications')->where('id', $failed)->value('delivery_status'));
        Queue::assertPushedOn('notifications', SendNotificationEmail::class);
        self::assertSame(1, DB::table('audit_entries')->where('action', 'notification.retry')->count());
        self::assertCount(2, $controller->adminNotifications()->getData(true)['data']);
    }

    public function test_redispatch_queues_only_recent_undelivered_notifications(): void
    {
        Queue::fake();
        $recent = $this->notification();
        DB::table('notifications')->where('id', $recent)->update(['created_at' => now()->subMinutes(10)]);
        $fresh = $this->notification();
        $old = $this->notification();
        DB::table('notifications')->where('id', $old)->update(['created_at' => now()->subDay()]);
        $tried = $this->notification();
        DB::table('notifications')->where('id', $tried)->update(['created_at' => now()->subMinutes(10), 'delivery_attempts' => 1]);
        $this->artisan('notifications:redispatch')->assertSuccessful();
        Queue::assertPushed(SendNotificationEmail::class, 1);
        Queue::assertPushed(SendNotificationEmail::class, fn ($job) => $job->notificationId === $recent);
        self::assertNotSame($fresh, $recent);
    }

    public function test_processing_overview_reports_backlog_and_failures_without_internals(): void
    {
        $this->notification('failed');
        Outbox::record('booking.confirmed', ['booking_id' => 1, 'user_id' => 7]);
        DB::table('failed_jobs')->insert(['uuid' => (string) Str::uuid(), 'connection' => 'database', 'queue' => 'notifications', 'payload' => '{"secret":"x"}', 'exception' => 'Trace with /app/path', 'failed_at' => now()]);
        $data = app(BookingController::class)->processing()->getData(true)['data'];
        self::assertSame(1, $data['outbox_pending']);
        self::assertSame(1, $data['failed_jobs']);
        self::assertSame(1, $data['failed_notifications']);
        self::assertSame(['id', 'queue', 'failed_at'], array_keys($data['recent_failed_jobs'][0]));
        self::assertStringNotContainsString('secret', json_encode($data));
    }

    public function test_publishing_failure_is_logged_and_keeps_the_event_in_the_outbox(): void
    {
        Outbox::record('booking.confirmed', ['booking_id' => 1, 'user_id' => 7]);
        $this->app->instance(Broker::class, new class extends Broker
        {
            public function connect(): AMQPStreamConnection
            {
                throw new \RuntimeException('RabbitMQ is down');
            }
        });
        Log::spy();
        $this->artisan('events:publish')->assertExitCode(1);
        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context) => $message === 'Outbox publishing failed' && $context['message'] === 'RabbitMQ is down')->once();
        self::assertSame(1, DB::table('outbox')->whereNull('published_at')->count());
    }

    public function test_business_events_are_written_to_the_log_in_plain_russian_without_personal_data(): void
    {
        Log::spy();
        Outbox::record('booking.confirmed', ['booking_id' => 12, 'user_id' => 7]);
        ReservationService::audit(1, 'session.extended', 5, ['minutes' => 30]);
        Log::shouldHaveReceived('info')->withArgs(fn ($message, $context) => $message === 'Бронь №12 создана' && $context['event'] === 'booking.confirmed' && $context['booking_id'] === 12)->once();
        Log::shouldHaveReceived('info')->withArgs(fn ($message, $context) => $message === 'Сессия №5 продлена на 30 мин' && $context['event'] === 'audit.session.extended')->once();
    }
}
