<?php

namespace App\Services;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use RuntimeException;

class Broker
{
    public function connect(): AMQPStreamConnection
    {
        return new AMQPStreamConnection((string) config('shift.rabbitmq.host'), (int) config('shift.rabbitmq.port'), (string) config('shift.rabbitmq.user'), (string) config('shift.rabbitmq.password'), (string) config('shift.rabbitmq.vhost'), false, 'AMQPLAIN', null, 'en_US', 3, 65, null, false, 30);
    }

    public static function name(string $suffix): string
    {
        return config('shift.rabbitmq.namespace', 'shift').'.'.$suffix;
    }

    public function topology(AMQPChannel $channel): void
    {
        $channel->exchange_declare(self::name('events'), 'topic', false, true, false);
        $channel->exchange_declare(self::name('dead'), 'topic', false, true, false);
        $channel->queue_declare(self::name('booking.events'), false, true, false, false, false, new AMQPTable(['x-dead-letter-exchange' => self::name('dead')]));
        foreach (['booking.#', 'session.#', 'club.#'] as $key) {
            $channel->queue_bind(self::name('booking.events'), self::name('events'), $key);
        }
        $channel->queue_declare(self::name('booking.dead'), false, true, false, false);
        $channel->queue_bind(self::name('booking.dead'), self::name('dead'), '#');
        foreach ([5000, 30000, 120000] as $delay) {
            $channel->queue_declare(self::name('booking.retry.').$delay, false, true, false, false, false, new AMQPTable(['x-message-ttl' => $delay, 'x-dead-letter-exchange' => self::name('events'), 'x-dead-letter-routing-key' => 'booking.retry']));
        }
        $channel->confirm_select();
        $channel->basic_qos(0, 1, false);
    }

    /** @param array<string,mixed> $envelope */
    public function message(array $envelope, int $attempt = 0): AMQPMessage
    {
        return new AMQPMessage(json_encode($envelope, JSON_THROW_ON_ERROR), ['content_type' => 'application/json', 'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, 'message_id' => $envelope['event_id'], 'application_headers' => new AMQPTable(['attempt' => $attempt])]);
    }

    /** @param array<string,mixed> $envelope */
    public function publishConfirmed(AMQPChannel $channel, array $envelope, string $routingKey): void
    {
        $this->publishMessageConfirmed($channel, $this->message($envelope), self::name('events'), $routingKey);
    }

    public function publishMessageConfirmed(AMQPChannel $channel, AMQPMessage $message, string $exchange, string $routingKey): void
    {
        $eventId = $message->has('message_id') ? (string) $message->get('message_id') : 'unknown';
        $channel->set_nack_handler(static function (AMQPMessage $message) use ($eventId): void {
            throw new RuntimeException('RabbitMQ negatively acknowledged event '.$eventId.'.');
        });
        $channel->set_return_listener(static function (int $replyCode, string $replyText, string $returnedExchange, string $returnedRoutingKey, AMQPMessage $message) use ($eventId): void {
            throw new RuntimeException(sprintf('RabbitMQ returned event %s (reply %d: %s, exchange %s, routing key %s).', $eventId, $replyCode, $replyText, $returnedExchange, $returnedRoutingKey));
        });

        $channel->basic_publish($message, $exchange, $routingKey, true);
        $channel->wait_for_pending_acks_returns(5);
    }
}
