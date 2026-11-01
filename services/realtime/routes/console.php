<?php

use Illuminate\Support\Facades\Schedule;

// Вложения чата живут 30 дней после закрытия брони.
Schedule::command('chat:prune-attachments')->dailyAt('03:30')->withoutOverlapping();

// Секретные сообщения живут 24 часа после закрытия брони.
Schedule::command('chat:prune-secrets')->hourly()->withoutOverlapping();
