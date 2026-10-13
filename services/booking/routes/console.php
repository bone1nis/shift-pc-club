<?php

use App\Services\PrometheusMetrics;
use Illuminate\Support\Facades\Schedule;

// Публикация outbox каждые 10 секунд: события доходят до других сервисов почти сразу.
Schedule::command('events:publish')->everyTenSeconds()->withoutOverlapping();
Schedule::command('club:reconcile')->everyMinute()->withoutOverlapping();
Schedule::command('club:sync')->everyMinute()->withoutOverlapping();
Schedule::call(fn () => app(PrometheusMetrics::class)->heartbeat('scheduler'))->everyMinute()->name('scheduler-heartbeat');
Schedule::command('reports:prune')->hourly()->withoutOverlapping();
Schedule::command('notifications:redispatch')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('reports:daily')->everyThirtyMinutes()->withoutOverlapping();
