<?php

namespace App\Console\Commands;

use App\Services\Broker;
use App\Services\EventHandler;
use App\Services\PrometheusMetrics;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use PhpAmqpLib\Exception\AMQPTimeoutException;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;

class ConsumeEvents extends Command
{
    protected $signature = 'events:consume {--once}';

    protected $description = 'Process RabbitMQ events (participants projection, WebSocket signals) with inbox, bounded retries and dead letters.';

    public function handle(Broker $broker, EventHandler $handler, PrometheusMetrics $metrics): int
    {
        $connection = $broker->connect();
        $channel = $connection->channel();
        $broker->topology($channel);
        $metrics->heartbeat('worker');
        $callback = function (AMQPMessage $message) use ($handler, $channel, $broker, $metrics): void {
            $metrics->heartbeat('worker');
            $headers = $message->has('application_headers') ? $message->get('application_headers')->getNativeData() : [];
            $attempt = (int) ($headers['attempt'] ?? 0);
            try {
                $event = json_decode($message->getBody(), true, 512, JSON_THROW_ON_ERROR);
                if (! is_array($event)) {
                    throw new \InvalidArgumentException('Expected event object.');
                }
                $fresh = $handler->process($event);
                Log::info(($fresh ? 'Событие обработано: ' : 'Повтор события пропущен: ').($event['type'] ?? '?'), ['event' => $fresh ? 'event.processed' : 'event.duplicate', 'event_id' => $event['event_id'] ?? null, 'attempt' => $attempt]);
                $metrics->count($fresh ? 'processed' : 'duplicate');
                // Подтверждение только после сохранения в базе (транзакция внутри process уже зафиксирована).
                $message->ack();
            } catch (\Throwable $e) {
                Log::warning('Event processing failed', ['event_id' => $message->has('message_id') ? $message->get('message_id') : null, 'attempt' => $attempt, 'exception_class' => $e::class]);
                if ($attempt >= 4 || $e instanceof \InvalidArgumentException || $e instanceof \JsonException) {
                    $metrics->count('dead');
                    $message->reject(false);

                    return;
                }
                $metrics->count('retry');
                $copy = new AMQPMessage($message->getBody(), ['content_type' => 'application/json', 'delivery_mode' => 2, 'message_id' => $message->has('message_id') ? $message->get('message_id') : 'unknown', 'application_headers' => new AMQPTable(['attempt' => $attempt + 1])]);
                $delay = [5000, 30000, 120000, 120000][$attempt];
                $broker->publishMessageConfirmed($channel, $copy, '', Broker::name('realtime.retry.'.$delay));
                $message->ack();
            }
        };
        try {
            if ($this->option('once')) {
                $message = $channel->basic_get(Broker::name('realtime.events'));
                if ($message) {
                    $callback($message);
                }

                return self::SUCCESS;
            }
            $channel->basic_consume(Broker::name('realtime.events'), '', false, false, false, false, $callback);
            while ($channel->is_consuming()) {
                try {
                    $channel->wait(null, false, 15);
                } catch (AMQPTimeoutException) {
                    // Тихая очередь — это нормально; в простое просто обновляем пульс воркера.
                }
                $metrics->heartbeat('worker');
            }
        } finally {
            $channel->close();
            $connection->close();
        }

        return self::SUCCESS;
    }
}
