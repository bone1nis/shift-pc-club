<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbox', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->jsonb('payload');
            $table->timestampTz('created_at');
            $table->timestampTz('published_at')->nullable()->index();
        });
        Schema::create('inbox', function (Blueprint $table) {
            $table->uuid('event_id')->primary();
            $table->timestampTz('processed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inbox');
        Schema::dropIfExists('outbox');
    }
};
