<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Administrator
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(($request->attributes->get('actor')['role'] ?? null) === 'admin', 403, 'Administrator role required.');

        return $next($request);
    }
}
