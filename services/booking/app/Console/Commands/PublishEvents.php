<?php

namespace App\Console\Commands;

use App\Services\Broker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PublishEvents extends Command
{
    protected $signature = 'events:publish {--limit=100}';

    protected $description = 'Publish committed outbox events with RabbitMQ publisher confirms.';

    public function handle(Broker $broker): int
    {
        // Планировщик запускает команду без вывода, поэтому причину сбоя пишем в лог (события остаются в outbox).
        try {
            return $this->publish($broker);
        } catch (\Throwable $e) {
            Log::warning('Outbox publishing failed', ['exception_class' => $e::class, 'message' => mb_substr($e->getMessage(), 0, 200)]);

            return self::FAILURE;
        }
    }

    private function publish(Broker $broker): int
    {
        $connection = $broker->connect();
        $channel = $connection->channel();
        $broker->topology($channel);
        try {
            for ($i = 0; $i < (int) $this->option('limit'); $i++) {
                $found = DB::transaction(function () use ($broker, $channel): bool {
                    $row = DB::table('outbox')->whereNull('published_at')->orderBy('created_at')->lock('FOR UPDATE SKIP LOCKED')->first();
                    if (! $row) {
                        return false;
                    }
                    $envelope = json_decode($row->payload, true, 512, JSON_THROW_ON_ERROR);
                    $broker->publishConfirmed($channel, $envelope, $row->type);
                    DB::table('outbox')->where('id', $row->id)->update(['published_at' => now()]);

                    return true;
                });
                if (! $found) {
                    break;
                }
            }
        } finally {
            $channel->close();
            $connection->close();
        }

        return self::SUCCESS;
    }
}
