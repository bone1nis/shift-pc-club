<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;

/** Минимальные метрики воркера в формате Prometheus (пульс и счётчики событий), ключи Redis как у соседних сервисов. */
class PrometheusMetrics
{
    public function heartbeat(string $name): void
    {
        Redis::connection()->set($this->prefix().'heartbeat_'.$name, (string) time());
    }

    public function count(string $result): void
    {
        Redis::connection()->command('hincrby', [$this->prefix().'events', $result, 1]);
    }

    public function render(): string
    {
        $redis = Redis::connection();
        $service = (string) config('shift.service', 'realtime');
        $lines = [
            '# HELP shift_worker_heartbeat_timestamp_seconds Unix timestamp of the latest Realtime worker heartbeat.',
            '# TYPE shift_worker_heartbeat_timestamp_seconds gauge',
            'shift_worker_heartbeat_timestamp_seconds{service="'.$service.'"} '.(string) ($redis->command('get', [$this->prefix().'heartbeat_worker']) ?: 0),
            '# HELP shift_realtime_events_total Events handled by the Realtime consumer by result.',
            '# TYPE shift_realtime_events_total counter',
        ];
        foreach (($redis->command('hgetall', [$this->prefix().'events']) ?: []) as $result => $count) {
            $lines[] = 'shift_realtime_events_total{service="'.$service.'",result="'.str_replace(['\\', '"', "\n"], '', (string) $result).'"} '.(string) $count;
        }

        return implode("\n", $lines)."\n";
    }

    private function prefix(): string
    {
        return 'shift:'.(string) config('shift.service', 'realtime').':metrics:';
    }
}
