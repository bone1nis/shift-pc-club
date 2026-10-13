<?php

use App\Services\PrometheusMetrics;
use Illuminate\Support\Facades\Schedule;

Schedule::command('events:publish')->everyMinute()->withoutOverlapping();
Schedule::call(fn () => app(PrometheusMetrics::class)->heartbeat('scheduler'))->everyMinute()->name('scheduler-heartbeat');
