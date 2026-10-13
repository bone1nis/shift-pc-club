<?php

namespace App\Http\Middleware;

use App\Services\PrometheusMetrics;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RecordMetrics
{
    public function handle(Request $request, Closure $next): Response
    {
        // Номер запроса от прокси попадает в каждую запись журнала: по нему в Loki собирается весь путь запроса.
        if (is_string($request->header('X-Request-ID')) && $request->header('X-Request-ID') !== '') {
            Log::shareContext(['request_id' => $request->header('X-Request-ID')]);
        }
        $startedAt = hrtime(true);
        $status = 500;

        try {
            $response = $next($request);
            $status = $response->getStatusCode();

            return $response;
        } finally {
            try {
                app(PrometheusMetrics::class)->observe($request, $status, (hrtime(true) - $startedAt) / 1_000_000_000);
            } catch (\Throwable) {
                // Метрики собираются по возможности и не должны менять поведение запроса.
            }
        }
    }
}
