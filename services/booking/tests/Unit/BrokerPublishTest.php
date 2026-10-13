<?php

namespace Tests\Unit;

use App\Services\Broker;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Message\AMQPMessage;
use RuntimeException;
use Tests\TestCase;

class BrokerPublishTest extends TestCase
{
    public function test_event_is_mandatory_and_waits_for_publisher_confirmation(): void
    {
        $channel = \Mockery::mock(AMQPChannel::class);
        $channel->shouldReceive('set_nack_handler')->once();
        $channel->shouldReceive('set_return_listener')->once();
        $channel->shouldReceive('basic_publish')->once()->withArgs(function (AMQPMessage $message, string $exchange, string $key, bool $mandatory): bool {
            self::assertSame('shift.events', $exchange);
            self::assertSame('booking.confirmed', $key);
            self::assertTrue($mandatory);
            self::assertSame('event-123', $message->get('message_id'));

            return true;
        });
        $channel->shouldReceive('wait_for_pending_acks_returns')->once()->with(5);

        app(Broker::class)->publishConfirmed($channel, ['event_id' => 'event-123'], 'booking.confirmed');
    }

    public function test_negative_confirmation_keeps_event_unpublished_by_throwing(): void
    {
        $nack = null;
        $channel = \Mockery::mock(AMQPChannel::class);
        $channel->shouldReceive('set_nack_handler')->once()->andReturnUsing(function (callable $callback) use (&$nack): void {
            $nack = $callback;
        });
        $channel->shouldReceive('set_return_listener')->once();
        $channel->shouldReceive('basic_publish')->once();
        $channel->shouldReceive('wait_for_pending_acks_returns')->once()->andReturnUsing(function () use (&$nack): void {
            $nack(new AMQPMessage('event'));
        });

        try {
            app(Broker::class)->publishConfirmed($channel, ['event_id' => 'event-123'], 'booking.confirmed');
            self::fail('A negative publisher confirmation must fail the publish operation.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('event-123', $exception->getMessage());
        }
    }

    public function test_unroutable_return_keeps_event_unpublished_by_throwing(): void
    {
        $returned = null;
        $channel = \Mockery::mock(AMQPChannel::class);
        $channel->shouldReceive('set_nack_handler')->once();
        $channel->shouldReceive('set_return_listener')->once()->andReturnUsing(function (callable $callback) use (&$returned): void {
            $returned = $callback;
        });
        $channel->shouldReceive('basic_publish')->once()->withArgs(function (AMQPMessage $message, string $exchange, string $key, bool $mandatory): bool {
            return $mandatory;
        });
        $channel->shouldReceive('wait_for_pending_acks_returns')->once()->andReturnUsing(function () use (&$returned): void {
            $returned(312, 'NO_ROUTE', 'shift.events', 'booking.unknown', new AMQPMessage('event'));
        });

        try {
            app(Broker::class)->publishConfirmed($channel, ['event_id' => 'event-123'], 'booking.unknown');
            self::fail('An unroutable event must fail the publish operation.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('event-123', $exception->getMessage());
            self::assertStringContainsString('booking.unknown', $exception->getMessage());
        }
    }
}
