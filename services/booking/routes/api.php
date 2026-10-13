<?php

use App\Http\Controllers\BookingController as Booking;
use App\Http\Controllers\ReportExportController;
use App\Http\Controllers\SiteEventController;
use Illuminate\Support\Facades\Route;

Route::prefix('booking')->group(function (): void {
    Route::post('events', [SiteEventController::class, 'store'])->middleware('throttle:site-events');
    Route::get('availability', [Booking::class, 'availability'])->middleware('throttle:api');
    Route::post('internal/workstations/{id}/maintenance', [Booking::class, 'maintenance'])->middleware('shift.internal');
    Route::middleware(['shift.auth', 'shift.csrf', 'throttle:api'])->group(function (): void {
        Route::get('bookings', [Booking::class, 'bookings']);
        Route::post('bookings', [Booking::class, 'create']);
        Route::get('bookings/{id}', [Booking::class, 'booking']);
        Route::post('bookings/{id}/cancel', [Booking::class, 'cancel']);
        Route::get('sessions', [Booking::class, 'sessions']);
        Route::get('notifications', [Booking::class, 'notifications']);
        Route::prefix('admin')->middleware('shift.admin')->group(function (): void {
            Route::get('bookings', [Booking::class, 'bookings']);
            Route::post('bookings', [Booking::class, 'createAdmin']);
            Route::get('sessions', [Booking::class, 'sessions']);
            Route::post('bookings/{id}/check-in', [Booking::class, 'checkIn']);
            Route::post('bookings/{id}/cancel', [Booking::class, 'cancel']);
            Route::post('sessions', [Booking::class, 'guest']);
            Route::post('sessions/{id}/end', [Booking::class, 'end']);
            Route::post('sessions/{id}/pay', [Booking::class, 'pay']);
            Route::post('sessions/{id}/extend', [Booking::class, 'extend']);
            Route::post('sessions/{id}/move', [Booking::class, 'move']);
            Route::get('audit', [Booking::class, 'audit']);
            Route::get('processing', [Booking::class, 'processing']);
            Route::get('notifications', [Booking::class, 'adminNotifications']);
            Route::post('notifications/{id}/retry', [Booking::class, 'retryNotification'])->whereNumber('id');
            Route::get('reports', [Booking::class, 'reports']);
            Route::get('daily-reports', [Booking::class, 'dailyReports']);
            Route::get('report-exports', [ReportExportController::class, 'index']);
            Route::post('report-exports', [ReportExportController::class, 'store']);
            Route::get('report-exports/{id}/download', [ReportExportController::class, 'download'])->whereUuid('id');
            Route::get('users/{userId}/history', [Booking::class, 'userHistory']);
        });
    });
});
