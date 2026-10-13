<?php

use App\Http\Controllers\ClubController as Club;
use Illuminate\Support\Facades\Route;

Route::prefix('club')->group(function (): void {
    Route::get('catalog', [Club::class, 'catalog'])->middleware('throttle:api');
    Route::get('profile', [Club::class, 'profile'])->middleware('throttle:api');
    Route::get('internal/catalog', [Club::class, 'catalog'])->middleware('shift.internal');
    Route::prefix('admin')->middleware(['shift.auth', 'shift.admin', 'shift.csrf', 'throttle:api'])->group(function (): void {
        Route::post('zones', [Club::class, 'zone']);
        Route::patch('zones/{id}', [Club::class, 'zone']);
        Route::patch('workstations/{id}', [Club::class, 'workstation']);
        Route::patch('tariffs/{id}', [Club::class, 'tariff']);
        Route::patch('profile', [Club::class, 'updateProfile']);
        Route::get('audit', [Club::class, 'audit']);
    });
});
