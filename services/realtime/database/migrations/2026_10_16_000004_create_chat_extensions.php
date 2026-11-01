<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_participants', function (Blueprint $table): void {
            $table->unsignedBigInteger('last_read_message_id')->nullable();
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('uploader_id');
            $table->string('path', 255);
            $table->string('name', 120);
            $table->string('mime', 64);
            $table->unsignedInteger('size');
            $table->timestampTz('created_at')->useCurrent();
            $table->index('conversation_id');
        });

        Schema::table('messages', function (Blueprint $table): void {
            $table->unsignedBigInteger('attachment_id')->nullable();
            $table->index('attachment_id');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->dropColumn('attachment_id');
        });
        Schema::dropIfExists('attachments');
        Schema::table('booking_participants', function (Blueprint $table): void {
            $table->dropColumn('last_read_message_id');
        });
    }
};
