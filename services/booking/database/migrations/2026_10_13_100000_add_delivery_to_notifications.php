<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('delivery_status', 16)->default('pending')->index();
            $table->unsignedSmallInteger('delivery_attempts')->default(0);
            $table->string('delivery_error')->nullable();
            $table->timestampTz('sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['delivery_status', 'delivery_attempts', 'delivery_error', 'sent_at']);
        });
    }
};
