<?php

namespace App\Services;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use RuntimeException;

/** Подключение и топология RabbitMQ по образцу Broker сервиса Booking, но со своими очередями realtime. */
class Broker
{
    /** Ключи привязки: только то, что нужно проекции и сигналам (без booking.retry, чтобы не ловить чужие повторы). */
    public const BINDINGS = ['booking.confirmed', 'booking.cancelled', 'booking.checked_in', 'booking.no_show', 'booking.reminder', 'booking.maintenance_changed', 'session.#', 'club.#', 'complaint.#'];

    public const RETRY_DELAYS = [5000, 30000, 120000];

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
        // Своя точка недоставленных сообщений: общий обмен dead уже привязан к booking.dead по '#'.
        $channel->exchange_declare(self::name('realtime.dead'), 'topic', false, true, false);
        $channel->queue_declare(self::name('realtime.events'), false, true, false, false, false, new AMQPTable(['x-dead-letter-exchange' => self::name('realtime.dead')]));
        foreach (self::BINDINGS as $key) {
            $channel->queue_bind(self::name('realtime.events'), self::name('events'), $key);
        }
        $channel->queue_declare(self::name('realtime.dead'), false, true, false, false);
        $channel->queue_bind(self::name('realtime.dead'), self::name('realtime.dead'), '#');
        foreach (self::RETRY_DELAYS as $delay) {
            // Возврат напрямую в очередь realtime (через обмен по ключу booking.retry сообщение попало бы и в Booking).
            $channel->queue_declare(self::name('realtime.retry.').$delay, false, true, false, false, false, new AMQPTable(['x-message-ttl' => $delay, 'x-dead-letter-exchange' => '', 'x-dead-letter-routing-key' => self::name('realtime.events')]));
        }
        $channel->confirm_select();
        $channel->basic_qos(0, 1, false);
    }

    /** @param array<string,mixed> $envelope */
    public function message(array $envelope, int $attempt = 0): AMQPMessage
    {
        return new AMQPMessage(json_encode($envelope, JSON_THROW_ON_ERROR), ['content_type' => 'application/json', 'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT, 'message_id' => $envelope['event_id'], 'application_headers' => new AMQPTable(['attempt' => $attempt])]);
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
