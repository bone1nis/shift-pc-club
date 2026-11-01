<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Administrator
{
    public function handle(Request $request, Closure $next): Response
    {
        // Владелец (owner) имеет все права администратора; обратное неверно.
        abort_unless(in_array($request->attributes->get('actor')['role'] ?? null, ['admin', 'owner'], true), 403, 'Administrator role required.');

        return $next($request);
    }
}
