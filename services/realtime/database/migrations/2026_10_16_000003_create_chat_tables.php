<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('booking_id')->unique();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampsTz();
        });

        // kind=secret: поля ciphertext/nonce/envelopes зарезервированы под T19.
        Schema::create('messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('sender_id');
            $table->string('kind', 16)->default('text');
            $table->text('body')->nullable();
            $table->text('ciphertext')->nullable();
            $table->text('nonce')->nullable();
            $table->jsonb('envelopes')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['conversation_id', 'id']);
        });

        Schema::table('booking_participants', function (Blueprint $table): void {
            $table->timestampTz('muted_at')->nullable();
        });

        Schema::create('invitations', function (Blueprint $table): void {
            $table->id();
            $table->string('token', 64)->unique();
            $table->unsignedBigInteger('booking_id')->index();
            $table->unsignedBigInteger('created_by');
            $table->timestampTz('expires_at');
            $table->unsignedBigInteger('used_by')->nullable();
            $table->timestampTz('used_at')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
        Schema::table('booking_participants', function (Blueprint $table): void {
            $table->dropColumn('muted_at');
        });
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
