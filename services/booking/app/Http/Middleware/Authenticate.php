<?php

namespace App\Http\Middleware;

use App\Services\TokenService;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class Authenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (is_string($request->cookie('shift_access')) ? $request->cookie('shift_access') : '');
        try {
            $claims = app(TokenService::class)->decode($token);
        } catch (\Throwable $e) {
            abort(401, 'Authentication required.');
        }
        if (config('shift.service') === 'identity') {
            $actor = app(TokenService::class)->actor($claims);
        } else {
            try {
                $response = Http::timeout(3)->withHeaders(['X-Internal-Token' => config('shift.internal_token')])->post(config('shift.identity_url').'/api/auth/internal/introspect', ['token' => $token]);
                abort_if($response->serverError(), 503, 'Identity verification unavailable.');
                abort_unless($response->successful(), 401, 'Session is inactive.');
                $actor = $response->json('data');
            } catch (ConnectionException $e) {
                abort(503, 'Identity verification unavailable.');
            }
        }
        abort_unless(is_array($actor) && isset($actor['id'], $actor['role']), 401, 'Session is inactive.');
        $request->attributes->set('actor', $actor);
        $request->attributes->set('claims', $claims);

        return $next($request);
    }
}
