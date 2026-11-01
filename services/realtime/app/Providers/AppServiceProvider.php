<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        require base_path('routes/channels.php');
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute((int) config('shift.api_throttle_per_minute'))->by($request->ip()));
        RateLimiter::for('chat-send', fn (Request $request) => Limit::perMinute((int) config('shift.chat_send_per_minute'))->by('chat:'.(is_array($a = $request->attributes->get('actor')) ? $a['id'] : $request->ip())));
        RateLimiter::for('chat-accept', fn (Request $request) => Limit::perMinute((int) config('shift.chat_accept_per_minute'))->by('chat-accept:'.(is_array($a = $request->attributes->get('actor')) ? $a['id'] : $request->ip())));
    }
}
