<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_exports', function (Blueprint $table) {
            $table->unsignedBigInteger('zone_id')->nullable();
        });
        Schema::create('daily_club_reports', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->jsonb('payload');
            $table->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_club_reports');
        Schema::table('report_exports', function (Blueprint $table) {
            $table->dropColumn('zone_id');
        });
    }
};
