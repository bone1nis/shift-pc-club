<?php

namespace App\Providers;

use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Scramble::ignoreDefaultRoutes();
        $resetUrl = fn ($user, string $token): string => config('shift.origin').'/auth?token='.rawurlencode($token).'&email='.rawurlencode($user->email);
        ResetPassword::createUrlUsing($resetUrl);
        ResetPassword::toMailUsing(fn ($user, string $token) => (new MailMessage)
            ->subject('SHIFT: восстановление пароля')
            ->greeting('Здравствуйте!')
            ->line('Мы получили запрос на смену пароля для вашего аккаунта SHIFT.')
            ->action('Задать новый пароль', $resetUrl($user, $token))
            ->line('Ссылка действует 60 минут. Если вы не запрашивали смену пароля, просто проигнорируйте письмо.')
            ->salutation('До встречи в клубе, SHIFT'));
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute((int) config('shift.auth_throttle_per_minute'))->by($request->ip()));
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute((int) config('shift.api_throttle_per_minute'))->by($request->ip()));
        Scramble::registerApi('identity', ['api_path' => ['include' => 'api/auth', 'exclude' => ['api/auth/internal/*', 'api/auth/openapi.json']]]);
        Scramble::configure('identity')->withDocumentTransformers(function (OpenApi $openApi): void {
            $openApi->secure(SecurityScheme::apiKey('cookie', 'shift_access'));
        });
        Scramble::registerJsonSpecificationRoute('api/auth/openapi.json', 'identity');
    }
}
