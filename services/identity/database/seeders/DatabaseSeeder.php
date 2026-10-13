<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Demo seed is local only.');
        }
        foreach ([['admin@shift.local', 'Администратор', 'admin'], ['player@shift.local', 'Игрок', 'player']] as [$email,$name,$role]) {
            DB::table('users')->insertOrIgnore(['email' => $email, 'name' => $name, 'password' => Hash::make('ShiftDemo2026!'), 'role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        }
    }
}
