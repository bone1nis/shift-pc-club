<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_events', function (Blueprint $table) {
            $table->id();
            $table->string('type', 24);
            $table->string('path', 32);
            // Случайный идентификатор вкладки из sessionStorage; не позволяет отследить человека между визитами.
            $table->string('visitor', 36);
            $table->string('environment', 16);
            $table->timestampTz('created_at');
            $table->index(['type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_events');
    }
};
