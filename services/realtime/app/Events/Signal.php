<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/** Сигнал «что-то изменилось»: в теле только тип и id (схема в packages/contracts/src/realtime.ts). */
class Signal implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /** @param 'account.changed'|'hall.changed'|'complaint.created' $name */
    public function __construct(public string $name, public string $channel, public string $type, public int $id) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel($this->channel)];
    }

    public function broadcastAs(): string
    {
        return $this->name;
    }

    /** @return array{type:string,id:int} */
    public function broadcastWith(): array
    {
        return ['type' => $this->type, 'id' => $this->id];
    }
}
