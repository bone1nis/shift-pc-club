<?php

namespace Tests\Feature;

use App\Events\Signal;
use App\Services\Broker;
use Illuminate\Contracts\Broadcasting\Factory;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use Tests\TestCase;

/** Настоящие RabbitMQ и PostgreSQL; своё пространство имён на тест, чтобы не трогать работающий воркер. */
class RabbitMqIntegrationTest extends TestCase
{
    use DatabaseMigrations;

    private const QUEUES = ['realtime.events', 'realtime.dead', 'realtime.retry.5000', 'realtime.retry.30000', 'realtime.retry.120000'];

    protected function setUp(): void
    {
        parent::setUp();
        config(['shift.rabbitmq.namespace' => 'it'.Str::lower(Str::random(10))]);
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
            foreach (self::QUEUES as $queue) {
                $channel->queue_delete(Broker::name($queue));
            }
            foreach (['events', 'realtime.dead'] as $exchange) {
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

    /** @param array<string,mixed> $event */
    private function publish(array $event, string $key, bool $raw = false): void
    {
        [$connection, $channel] = $this->channel();
        $body = $raw ? (string) $event['raw'] : json_encode($event, JSON_THROW_ON_ERROR);
        $channel->basic_publish(new AMQPMessage($body, ['delivery_mode' => 2, 'message_id' => $event['event_id'] ?? 'poison']), Broker::name('events'), $key);
        $connection->close();
    }

    public function test_event_is_consumed_once_projected_signalled_and_duplicate_is_skipped(): void
    {
        Event::fake([Signal::class]);
        $event = ['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => 'booking.confirmed', 'payload' => ['booking_id' => 21, 'user_id' => 4]];
        $this->publish($event, 'booking.confirmed');
        $this->publish($event, 'booking.confirmed');
        $this->assertSame(2, $this->queueDepth('realtime.events'));

        $this->artisan('events:consume --once')->assertSuccessful();
        $this->artisan('events:consume --once')->assertSuccessful();

        $this->assertSame(0, $this->queueDepth('realtime.events'));
        $this->assertSame(1, DB::table('inbox')->count());
        $this->assertSame('owner', DB::table('booking_participants')->where('booking_id', 21)->value('role'));
        Event::assertDispatchedTimes(Signal::class, 2); // account.changed + hall.changed, один раз
    }

    public function test_complaint_published_by_club_with_mandatory_flag_is_routed_and_signals_owner(): void
    {
        Event::fake([Signal::class]);
        Mail::fake();
        Http::fake(['*' => Http::response(['data' => ['emails' => []]])]);
        [$connection, $channel] = $this->channel();
        $broker = app(Broker::class);
        $event = ['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => 'complaint.created', 'payload' => ['type' => 'complaint.created', 'id' => 33]];
        // Как Outbox в Club: подтверждение и mandatory; без привязки очереди realtime это упало бы возвратом.
        $broker->publishMessageConfirmed($channel, $broker->message($event), Broker::name('events'), 'complaint.created');
        $connection->close();

        $this->assertSame(1, $this->queueDepth('realtime.events'));
        $this->artisan('events:consume --once')->assertSuccessful();
        $this->assertSame(0, $this->queueDepth('realtime.events'));
        Event::assertDispatched(Signal::class, fn (Signal $s) => $s->name === 'complaint.created' && $s->channel === 'owner' && $s->id === 33);
    }

    public function test_unprocessable_message_goes_to_the_dead_letter_queue(): void
    {
        $this->publish(['raw' => 'not-json'], 'session.poison', true);
        $this->artisan('events:consume --once')->assertSuccessful();

        $this->assertSame(0, $this->queueDepth('realtime.events'));
        $this->assertSame(1, $this->queueDepth('realtime.dead'));
        $this->assertSame(0, DB::table('inbox')->count());
    }

    public function test_failed_handler_goes_to_retry_queue_and_inbox_stays_empty(): void
    {
        // Рассылка падает (например, Reverb недоступен): транзакция откатывается вместе с inbox.
        app()->bind(Factory::class, fn () => throw new \RuntimeException('reverb down'));
        $event = ['event_id' => (string) Str::uuid(), 'schema_version' => 1, 'type' => 'booking.confirmed', 'payload' => ['booking_id' => 22, 'user_id' => 4]];
        $this->publish($event, 'booking.confirmed');
        $this->artisan('events:consume --once')->assertSuccessful();

        $this->assertSame(0, $this->queueDepth('realtime.events'));
        $this->assertSame(1, $this->queueDepth('realtime.retry.5000'));
        // Транзакция откатилась: событие можно будет обработать повторно.
        $this->assertSame(0, DB::table('inbox')->count());
        $this->assertSame(0, DB::table('booking_participants')->count());
    }
}
