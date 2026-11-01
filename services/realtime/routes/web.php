<?php

use App\Services\PrometheusMetrics;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => config('shift.service'), 'status' => 'ok']));
Route::get('/metrics', fn (PrometheusMetrics $metrics) => response($metrics->render())->header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8'));
