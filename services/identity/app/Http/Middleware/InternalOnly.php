<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InternalOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('shift.internal_token');
        abort_unless(strlen($secret) >= 32 && hash_equals($secret, (string) $request->header('X-Internal-Token')), 403, 'Forbidden');

        return $next($request);
    }
}
