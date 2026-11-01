<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** Новое сообщение (текст или секрет) (схема chatMessageSchema в packages/contracts/src/realtime.ts). */
class MessageSent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    private const MAX_EVENT_BYTES = 8000;

    /**
     * @param  array<string,mixed>|null  $attachment
     * @param  array<string,mixed>|null  $secret  ciphertext, nonce, envelopes (тогда body = null)
     */
    public function __construct(public int $bookingId, public int $id, public int $conversationId, public int $senderId, public ?string $body, public string $createdAt, public ?array $attachment = null, public ?array $secret = null) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("booking.{$this->bookingId}.chat")];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /** @return array<string,mixed> */
    public function broadcastWith(): array
    {
        if ($this->secret !== null) {
            $base = ['id' => $this->id, 'conversationId' => $this->conversationId, 'senderId' => $this->senderId, 'kind' => 'secret', 'body' => null, 'createdAt' => $this->createdAt];
            $full = $base + $this->secret;

            // Pusher/Reverb режет событие около 10 КБ: большой секрет уходит как сигнал, клиент берёт его по REST.
            return strlen((string) json_encode($full)) > self::MAX_EVENT_BYTES ? $base + ['redacted' => true] : $full;
        }

        return ['id' => $this->id, 'conversationId' => $this->conversationId, 'senderId' => $this->senderId, 'kind' => 'text', 'body' => $this->body, 'createdAt' => $this->createdAt, 'attachment' => $this->attachment];
    }
}
