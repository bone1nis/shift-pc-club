<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/** Позиция прочтения участника выросла (схема messageReadSchema в packages/contracts/src/realtime.ts). */
class MessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $bookingId, public int $userId, public int $upToMessageId) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("booking.{$this->bookingId}.chat")];
    }

    public function broadcastAs(): string
    {
        return 'message.read';
    }

    /** @return array{userId:int,upToMessageId:int} */
    public function broadcastWith(): array
    {
        return ['userId' => $this->userId, 'upToMessageId' => $this->upToMessageId];
    }
}
