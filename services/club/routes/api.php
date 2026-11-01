<?php

use App\Http\Controllers\ClubController as Club;
use App\Http\Controllers\ComplaintController as Complaint;
use Illuminate\Support\Facades\Route;

Route::prefix('club')->group(function (): void {
    Route::get('catalog', [Club::class, 'catalog'])->middleware('throttle:api');
    Route::get('profile', [Club::class, 'profile'])->middleware('throttle:api');
    Route::get('owner-key', [Complaint::class, 'ownerKey'])->middleware('throttle:api');
    Route::post('complaints', [Complaint::class, 'store'])->middleware(['shift.auth', 'shift.csrf', 'throttle:api']);
    Route::prefix('owner')->middleware(['shift.auth', 'shift.owner', 'shift.csrf', 'throttle:api'])->group(function (): void {
        Route::put('key', [Complaint::class, 'registerKey']);
        Route::get('key-backup', [Complaint::class, 'keyBackup']);
        Route::get('complaints', [Complaint::class, 'index']);
        Route::get('complaints/{id}', [Complaint::class, 'show'])->whereNumber('id');
        Route::patch('complaints/{id}', [Complaint::class, 'update'])->whereNumber('id');
    });
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
