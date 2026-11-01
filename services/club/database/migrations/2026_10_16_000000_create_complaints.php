<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_keys', function (Blueprint $table) {
            $table->id();
            $table->string('public_key', 256);
            $table->boolean('active')->default(true);
            $table->timestampTz('created_at');
        });
        // Не больше одного активного ключа.
        DB::statement('CREATE UNIQUE INDEX owner_keys_one_active ON owner_keys (active) WHERE active');
        Schema::create('owner_key_backup', function (Blueprint $table) {
            $table->foreignId('owner_key_id')->primary()->constrained('owner_keys');
            $table->text('blob');
            $table->unsignedSmallInteger('version')->default(1);
            $table->timestampTz('created_at');
        });
        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            // Нужен только для лимита частоты; ни один API его не отдаёт.
            $table->unsignedBigInteger('user_id');
            $table->string('category', 24);
            $table->unsignedSmallInteger('rating')->nullable();
            $table->string('status', 12)->default('new');
            $table->foreignId('owner_key_id')->constrained('owner_keys');
            $table->string('ephemeral_public_key', 256);
            $table->string('nonce', 64);
            $table->text('ciphertext');
            $table->json('envelopes')->nullable();
            $table->timestampTz('created_at');
            $table->timestampTz('read_at')->nullable();
            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'id']);
        });
        DB::statement("ALTER TABLE complaints ADD CONSTRAINT complaints_category_check CHECK (category IN ('staff','equipment','service','booking','review','other'))");
        DB::statement("ALTER TABLE complaints ADD CONSTRAINT complaints_status_check CHECK (status IN ('new','read','closed'))");
        DB::statement('ALTER TABLE complaints ADD CONSTRAINT complaints_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)');
    }

    public function down(): void
    {
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('owner_key_backup');
        Schema::dropIfExists('owner_keys');
    }
};
