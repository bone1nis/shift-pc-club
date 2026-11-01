<?php

use App\Http\Controllers\BroadcastAuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\DeviceKeyController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::prefix('realtime')->group(function (): void {
    Route::get('health', HealthController::class)->middleware('throttle:api');
    Route::post('broadcasting/auth', BroadcastAuthController::class)->middleware(['shift.auth', 'shift.csrf', 'throttle:api']);

    Route::middleware(['shift.auth', 'shift.csrf', 'throttle:api'])->group(function (): void {
        Route::post('devices', [DeviceKeyController::class, 'register']);
        Route::delete('devices/{id}', [DeviceKeyController::class, 'revoke'])->whereNumber('id');
        Route::get('conversations/{bookingId}/keys', [DeviceKeyController::class, 'conversationKeys'])->whereNumber('bookingId');
        Route::get('conversations/{bookingId}', [ChatController::class, 'conversationShow'])->whereNumber('bookingId');
        Route::get('conversations/{bookingId}/messages', [ChatController::class, 'messages'])->whereNumber('bookingId');
        Route::post('conversations/{bookingId}/messages', [ChatController::class, 'send'])->whereNumber('bookingId')->middleware('throttle:chat-send');
        Route::post('conversations/{bookingId}/read', [ChatController::class, 'read'])->whereNumber('bookingId');
        Route::post('conversations/{bookingId}/attachments', [ChatController::class, 'attach'])->whereNumber('bookingId')->middleware('throttle:chat-send');
        Route::get('attachments/{attachmentId}', [ChatController::class, 'attachment'])->whereNumber('attachmentId');
        Route::delete('conversations/{bookingId}/messages/{messageId}', [ChatController::class, 'destroyMessage'])->whereNumber(['bookingId', 'messageId']);
        Route::post('conversations/{bookingId}/participants/{userId}/mute', [ChatController::class, 'mute'])->whereNumber(['bookingId', 'userId']);
        Route::post('bookings/{bookingId}/invitations', [ChatController::class, 'invite'])->whereNumber('bookingId');
        Route::post('invitations/{token}/accept', [ChatController::class, 'accept'])->where('token', '[A-Za-z0-9]{40}')->middleware('throttle:chat-accept');
    });
});
