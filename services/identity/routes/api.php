<?php

use App\Http\Controllers\AuthController as Auth;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::get('csrf', [Auth::class, 'csrf'])->middleware('throttle:auth');
    Route::post('internal/introspect', [Auth::class, 'introspect'])->middleware('shift.internal');
    Route::get('internal/users/{id}', [Auth::class, 'internalUser'])->middleware('shift.internal');
    Route::middleware(['shift.csrf', 'throttle:auth'])->group(function (): void {
        Route::post('register', [Auth::class, 'register']);
        Route::post('login', [Auth::class, 'login']);
        Route::post('refresh', [Auth::class, 'refresh']);
        Route::post('logout', [Auth::class, 'logout']);
        Route::post('forgot-password', [Auth::class, 'forgotPassword']);
        Route::post('reset-password', [Auth::class, 'resetPassword']);
    });
    Route::middleware(['shift.auth', 'shift.csrf', 'throttle:api'])->group(function (): void {
        Route::get('me', [Auth::class, 'me']);
        Route::patch('me', [Auth::class, 'updateProfile']);
        Route::post('logout-all', [Auth::class, 'logoutAll']);
        Route::get('sessions', [Auth::class, 'sessions']);
        Route::delete('sessions/{id}', [Auth::class, 'revoke']);
    });
    Route::middleware(['shift.auth', 'shift.admin', 'throttle:api'])->get('admin/users', [Auth::class, 'adminUsers']);
});
