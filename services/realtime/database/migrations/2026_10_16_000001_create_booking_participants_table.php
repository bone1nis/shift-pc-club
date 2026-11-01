<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Проекция участников брони; наполняет консьюмер событий Booking (T4).
        Schema::create('booking_participants', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->string('role', 32);
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['booking_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_participants');
    }
};
