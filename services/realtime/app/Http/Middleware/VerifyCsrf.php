<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyCsrf
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethodSafe()) {
            $origin = $request->header('Origin');
            $token = (is_string($request->cookie('XSRF-TOKEN')) ? $request->cookie('XSRF-TOKEN') : '');
            $header = (string) ($request->header('X-CSRF-TOKEN') ?: $request->header('X-XSRF-TOKEN'));
            $parts = explode('.', $token);
            $secret = (string) config('shift.csrf_secret');
            abort_unless(strlen($secret) >= 32 && $origin === config('shift.origin') && count($parts) === 2 && strlen($parts[0]) === 64 && hash_equals($token, urldecode($header)) && hash_equals(hash_hmac('sha256', $parts[0], $secret), $parts[1]), 419, 'CSRF token or Origin mismatch.');
        }

        return $next($request);
    }
}
