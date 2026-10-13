<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Scramble::ignoreDefaultRoutes();
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('site-events', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute((int) config('shift.api_throttle_per_minute'))->by($request->ip()));
        Scramble::registerApi('booking', ['api_path' => ['include' => 'api/booking', 'exclude' => ['api/booking/internal/*', 'api/booking/openapi.json']]]);
        Scramble::configure('booking')->withDocumentTransformers(function (OpenApi $openApi): void {
            $openApi->secure(SecurityScheme::apiKey('cookie', 'shift_access'));
        });
        Scramble::registerJsonSpecificationRoute('api/booking/openapi.json', 'booking');
    }
}
