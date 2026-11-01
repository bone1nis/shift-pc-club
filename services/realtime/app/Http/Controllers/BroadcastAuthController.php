<?php

namespace App\Http\Controllers;

use Illuminate\Auth\GenericUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class BroadcastAuthController extends Controller
{
    public function __invoke(Request $request): mixed
    {
        /** @var array{id:int,name?:string,role:string} $actor */
        $actor = $request->attributes->get('actor');
        $user = new GenericUser(['id' => $actor['id'], 'name' => $actor['name'] ?? '', 'role' => $actor['role']]);
        $request->setUserResolver(fn () => $user);

        return Broadcast::auth($request);
    }
}
