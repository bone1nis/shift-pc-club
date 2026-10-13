<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class PrometheusMetrics
{
    private const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    public function observe(Request $request, int $status, float $duration): void
    {
        if ($request->path() === 'metrics') {
            return;
        }
        $route = $request->route()?->uri() ?? 'unmatched';
        $method = strtoupper($request->method());
        $redis = Redis::connection();
        $prefix = $this->prefix();
        $requestLabels = ['service' => (string) config('shift.service', 'unknown'), 'method' => $method, 'route' => $route, 'status' => (string) $status];
        $requestKey = hash('sha256', json_encode($requestLabels, JSON_THROW_ON_ERROR));
        $redis->sadd($prefix.'request_series', $requestKey);
        $redis->hset($prefix.'request_labels', $requestKey, json_encode($requestLabels, JSON_THROW_ON_ERROR));
        $redis->hincrby($prefix.'requests', $requestKey, 1);
        $durationLabels = ['service' => (string) config('shift.service', 'unknown'), 'method' => $method, 'route' => $route];
        $durationKey = hash('sha256', json_encode($durationLabels, JSON_THROW_ON_ERROR));
        $redis->sadd($prefix.'duration_series', $durationKey);
        $redis->hset($prefix.'duration_labels', $durationKey, json_encode($durationLabels, JSON_THROW_ON_ERROR));
        $redis->hincrby($prefix.'duration_sum_us', $durationKey, (int) round($duration * 1_000_000));
        foreach (self::BUCKETS as $bucket) {
            if ($duration <= $bucket) {
                $redis->hincrby($prefix.'duration_bucket_'.$this->bucketKey($bucket), $durationKey, 1);
            }
        }
        $redis->hincrby($prefix.'duration_bucket_inf', $durationKey, 1);
    }

    public function heartbeat(string $name): void
    {
        Redis::connection()->set($this->prefix().'heartbeat_'.$name, (string) time());
    }

    public function render(): string
    {
        $redis = Redis::connection();
        $prefix = $this->prefix();
        $service = (string) config('shift.service', 'unknown');
        $lines = ['# HELP shift_http_requests_total Total HTTP requests handled by this service.', '# TYPE shift_http_requests_total counter'];
        foreach ($redis->command('smembers', [$prefix.'request_series']) ?: [] as $key) {
            $labels = json_decode((string) $redis->command('hget', [$prefix.'request_labels', $key]), true, 512, JSON_THROW_ON_ERROR);
            $lines[] = 'shift_http_requests_total'.$this->formatLabels($labels).' '.(string) ($redis->command('hget', [$prefix.'requests', $key]) ?: 0);
        }
        $lines[] = '# HELP shift_http_request_duration_seconds HTTP request duration in seconds.';
        $lines[] = '# TYPE shift_http_request_duration_seconds histogram';
        foreach ($redis->command('smembers', [$prefix.'duration_series']) ?: [] as $key) {
            $labels = json_decode((string) $redis->command('hget', [$prefix.'duration_labels', $key]), true, 512, JSON_THROW_ON_ERROR);
            foreach (self::BUCKETS as $bucket) {
                $lines[] = 'shift_http_request_duration_seconds_bucket'.$this->formatLabels($labels + ['le' => (string) $bucket]).' '.(string) ($redis->command('hget', [$prefix.'duration_bucket_'.$this->bucketKey($bucket), $key]) ?: 0);
            }
            $lines[] = 'shift_http_request_duration_seconds_bucket'.$this->formatLabels($labels + ['le' => '+Inf']).' '.(string) ($redis->command('hget', [$prefix.'duration_bucket_inf', $key]) ?: 0);
            $count = (int) ($redis->command('hget', [$prefix.'duration_bucket_inf', $key]) ?: 0);
            $sum = (int) ($redis->command('hget', [$prefix.'duration_sum_us', $key]) ?: 0);
            $lines[] = 'shift_http_request_duration_seconds_sum'.$this->formatLabels($labels).' '.number_format($sum / 1_000_000, 6, '.', '');
            $lines[] = 'shift_http_request_duration_seconds_count'.$this->formatLabels($labels).' '.$count;
        }
        $pending = DB::table('outbox')->whereNull('published_at');
        $oldest = (clone $pending)->min('created_at');
        $age = $oldest ? max(0, now()->getTimestamp() - CarbonImmutable::parse($oldest)->getTimestamp()) : 0;
        $lines[] = '# HELP shift_outbox_pending Number of unpublished outbox events.';
        $lines[] = '# TYPE shift_outbox_pending gauge';
        $lines[] = 'shift_outbox_pending'.$this->formatLabels(['service' => $service]).' '.(string) $pending->count();
        $lines[] = '# HELP shift_outbox_oldest_age_seconds Age of the oldest unpublished outbox event.';
        $lines[] = '# TYPE shift_outbox_oldest_age_seconds gauge';
        $lines[] = 'shift_outbox_oldest_age_seconds'.$this->formatLabels(['service' => $service]).' '.(string) $age;
        $lines[] = '# HELP shift_scheduler_heartbeat_timestamp_seconds Unix timestamp of the latest scheduler heartbeat.';
        $lines[] = '# TYPE shift_scheduler_heartbeat_timestamp_seconds gauge';
        $lines[] = 'shift_scheduler_heartbeat_timestamp_seconds'.$this->formatLabels(['service' => $service]).' '.(string) ($redis->command('get', [$prefix.'heartbeat_scheduler']) ?: 0);

        return implode("\n", $lines)."\n";
    }

    private function prefix(): string
    {
        return 'shift:'.(string) config('shift.service', 'unknown').':metrics:';
    }

    private function bucketKey(float $bucket): string
    {
        return str_replace('.', '_', (string) $bucket);
    }

    /** @param array<string,string> $labels */
    private function formatLabels(array $labels): string
    {
        $parts = [];
        foreach ($labels as $name => $value) {
            $escaped = str_replace(['\\', '"', "\n"], ['\\\\', '\\"', '\\n'], $value);
            $parts[] = $name.'="'.$escaped.'"';
        }

        return '{'.implode(',', $parts).'}';
    }
}
