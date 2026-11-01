<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Публичные ключи устройств (ECDH P-256) для секретных сообщений. Строки не удаляются:
        // смена ключа = новая строка, старая остаётся в истории (revoked_at ставится при отзыве).
        Schema::create('device_keys', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('public_key', 128);
            $table->string('device_label', 80)->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('revoked_at')->nullable();
            $table->unique(['user_id', 'public_key']);
            $table->index(['user_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_keys');
    }
};
