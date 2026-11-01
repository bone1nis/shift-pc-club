<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;

// Правила private-/presence-каналов. Роль берётся из introspect Identity (не из JWT).
// Закрытая бронь (closed_at) остаётся доступной на чтение: closed_at здесь не проверяется.
Broadcast::channel('user.{id}', fn ($user, string $id) => ctype_digit($id) && (int) $user->getAuthIdentifier() === (int) $id);
Broadcast::channel('hall', fn ($user) => in_array($user->role, ['admin', 'owner'], true));
Broadcast::channel('owner', fn ($user) => $user->role === 'owner');
Broadcast::channel('booking.{bookingId}.chat', function ($user, string $bookingId) {
    if (! ctype_digit($bookingId) || ! DB::table('booking_participants')->where('booking_id', (int) $bookingId)->where('user_id', (int) $user->getAuthIdentifier())->exists()) {
        return false;
    }

    return ['id' => (int) $user->getAuthIdentifier(), 'name' => (string) $user->name];
});
