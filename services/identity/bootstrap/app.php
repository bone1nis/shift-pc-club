<?php

use App\Http\Middleware\Administrator;
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\InternalOnly;
use App\Http\Middleware\PrivateResponses;
use App\Http\Middleware\RecordMetrics;
use App\Http\Middleware\VerifyCsrf;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['shift.auth' => Authenticate::class, 'shift.admin' => Administrator::class, 'shift.csrf' => VerifyCsrf::class, 'shift.internal' => InternalOnly::class]);
        $middleware->appendToGroup('api', PrivateResponses::class);
        $middleware->append(RecordMetrics::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Сообщения abort() пишутся по-английски; пользователю отдаём перевод из lang/ru.json.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            $message = $e->getMessage();
            $translated = __($message);
            if ($message === '' || $translated === $message || ! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            return response()->json(['message' => $translated], $e->getStatusCode(), $e->getHeaders());
        });
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $e) => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(function (QueryException $e, Request $request) {
            if (($e->errorInfo[0] ?? '') === '23P01') {
                return response()->json(['message' => 'Место уже занято на выбранное время.', 'code' => 'workstation_conflict'], 409);
            }

            return null;
        });
    })->create();
