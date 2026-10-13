<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role')->default('player');
            $t->timestampTz('blocked_at')->nullable();
        });
        Schema::create('auth_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->timestampTz('expires_at');
            $t->timestampTz('revoked_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('refresh_tokens', function (Blueprint $t) {
            $t->id();
            $t->uuid('session_id');
            $t->foreign('session_id')->references('id')->on('auth_sessions')->cascadeOnDelete();
            $t->string('hash', 64)->unique();
            $t->timestampTz('used_at')->nullable();
            $t->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('auth_sessions');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['role', 'blocked_at']));
    }
};
