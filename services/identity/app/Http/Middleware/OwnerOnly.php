<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OwnerOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        // Только владелец: администратор сюда не проходит.
        abort_unless(($request->attributes->get('actor')['role'] ?? null) === 'owner', 403, 'Owner role required.');

        return $next($request);
    }
}
