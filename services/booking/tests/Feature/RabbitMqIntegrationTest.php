<?php

namespace Tests\Feature;

use App\Jobs\SendNotificationEmail;
use App\Services\Broker;
use App\Services\Outbox;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use Tests\TestCase;

/**
 * Настоящие RabbitMQ и PostgreSQL. Каждый тест использует своё пространство имён,
 * поэтому работающие воркеры и их очереди не затрагиваются.
 */
class RabbitMqIntegrationTest extends TestCase
{
    use DatabaseMigrations;

    private string $namespace;

    protected function setUp(): void
    {
        parent::setUp();
        $this->namespace = 'it'.Str::lower(Str::random(10));
        config(['shift.rabbitmq.namespace' => $this->namespace]);
        try {
            app(Broker::class)->connect()->close();
        } catch (\Throwable $e) {
            $this->markTestSkipped('RabbitMQ is not reachable: '.$e->getMessage());
        }
    }

    protected function tearDown(): void
    {
        try {
            $connection = app(Broker::class)->connect();
            $channel = $connection->channel();
            foreach (['booking.events', 'booking.dead', 'booking.retry.5000', 'booking.retry.30000', 'booking.retry.120000'] as $queue) {
                $channel->queue_delete(Broker::name($queue));
            }
            foreach (['events', 'dead'] as $exchange) {
                $channel->exchange_delete(Broker::name($exchange));
            }
            $connection->close();
        } catch (\Throwable) {
            // Уборка объектов, созданных только для теста (по возможности).
        }
        parent::tearDown();
    }

    /** @return array{0:AMQPStreamConnection,1:AMQPChannel} */
    private function channel(): array
    {
        $connection = app(Broker::class)->connect();
        $channel = $connection->channel();
        app(Broker::class)->topology($channel);

        return [$connection, $channel];
    }

    private function queueDepth(string $queue): int
    {
        [$connection, $channel] = $this->channel();
        try {
            return (int) $channel->queue_declare(Broker::name($queue), true)[1];
        } finally {
            $connection->close();
        }
    }

    public function test_outbox_event_is_published_with_confirms_consumed_once_and_deduplicated(): void
    {
        Queue::fake();
        DB::table('bookings')->insert(['id' => 11, 'user_id' => 7, 'status' => 'confirmed', 'starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addHour(), 'total_price' => 18000, 'created_at' => now(), 'updated_at' => now()]);
        Outbox::record('booking.confirmed', ['booking_id' => 11, 'user_id' => 7]);
        $this->artisan('events:publish')->assertSuccessful();
        self::assertNotNull(DB::table('outbox')->value('published_at'));
        self::assertSame(1, $this->queueDepth('booking.events'));

        // Повторная доставка того же события не должна повторять побочные эффекты.
        $envelope = DB::table('outbox')->value('payload');
        [$connection, $channel] = $this->channel();
        $channel->basic_publish(new AMQPMessage($envelope, ['delivery_mode' => 2, 'message_id' => json_decode($envelope, true)['event_id']]), Broker::name('events'), 'booking.confirmed');
        $connection->close();
        self::assertSame(2, $this->queueDepth('booking.events'));

        $this->artisan('events:consume --once')->assertSuccessful();
        $this->artisan('events:consume --once')->assertSuccessful();
        self::assertSame(0, $this->queueDepth('booking.events'));
        self::assertSame(1, DB::table('inbox')->count());
        self::assertSame(1, DB::table('notifications')->count());
        Queue::assertPushed(SendNotificationEmail::class, 1);
    }

    public function test_unprocessable_message_goes_to_the_dead_letter_queue_without_retries(): void
    {
        [$connection, $channel] = $this->channel();
        $channel->basic_publish(new AMQPMessage('not-json', ['delivery_mode' => 2, 'message_id' => 'poison']), Broker::name('events'), 'booking.poison');
        $connection->close();
        $this->artisan('events:consume --once')->assertSuccessful();
        self::assertSame(0, $this->queueDepth('booking.events'));
        self::assertSame(1, $this->queueDepth('booking.dead'));
        self::assertSame(0, DB::table('inbox')->count());
    }

    public function test_failed_handler_is_retried_through_the_delay_queue(): void
    {
        [$connection, $channel] = $this->channel();
        // Корректный конверт, но обработчик падает: в напоминании идентификатор брони не является числом.
        $event = ['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => 'booking.reminder', 'payload' => ['user_id' => 7, 'booking_id' => ['x']]];
        $channel->basic_publish(new AMQPMessage(json_encode($event), ['delivery_mode' => 2, 'message_id' => $event['event_id']]), Broker::name('events'), 'booking.reminder');
        $connection->close();
        $this->artisan('events:consume --once')->assertSuccessful();
        self::assertSame(0, $this->queueDepth('booking.events'));
        self::assertSame(1, $this->queueDepth('booking.retry.5000'));
        self::assertSame(0, $this->queueDepth('booking.dead'));
    }
}
