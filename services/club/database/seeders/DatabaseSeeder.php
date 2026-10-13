<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Demo seed is local only.');
        }
        DB::transaction(function (): void {
            foreach ([[1, 'Арена', 'arena', '16 мощных станций для командной игры', 18000], [2, 'VIP', 'vip', '4 места с максимальным комфортом', 28000]] as [$id,$name,$slug,$description,$price]) {
                DB::table('zones')->insertOrIgnore(['id' => $id, 'name' => $name, 'slug' => $slug, 'description' => $description, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('tariffs')->insertOrIgnore(['id' => $id, 'zone_id' => $id, 'name' => 'Почасовой', 'hourly_price' => $price, 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
            }
            for ($id = 1; $id <= 20; $id++) {
                $vip = $id > 16;
                $index = $vip ? $id - 17 : $id - 1;
                DB::table('workstations')->insertOrIgnore(['id' => $id, 'zone_id' => $vip ? 2 : 1, 'name' => ($vip ? 'VIP-' : 'PC-').str_pad((string) ($vip ? $id - 16 : $id), 2, '0', STR_PAD_LEFT), 'status' => 'available', 'x' => $index % 4, 'y' => intdiv($index, 4), 'specs' => json_encode(['cpu' => $vip ? 'Intel Core i9-14900K' : 'Intel Core i7-14700F', 'gpu' => $vip ? 'GeForce RTX 4080 SUPER' : 'GeForce RTX 4070 SUPER', 'ram' => '32 GB DDR5', 'monitor' => $vip ? '27″ · 360 Hz' : '24.5″ · 240 Hz'], JSON_THROW_ON_ERROR), 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
            }
            // Вымышленный адрес и контакты демонстрационного клуба; правятся в админке.
            DB::table('club_profile')->insertOrIgnore([
                'id' => 1,
                'name' => 'SHIFT Gaming Club',
                'tagline' => 'Место, где игра становится больше',
                'description' => 'Двадцать игровых мест в двух залах: Арена для командных катков и VIP для тех, кто выбирает максимальный комфорт. Мощные компьютеры, мониторы до 360 Гц, удобные кресла, бар и круглосуточный администратор.',
                'city' => 'Москва',
                'address' => 'ул. Игровая, д. 12, стр. 3, 2 этаж',
                'landmark' => 'Станция метро «Киберпарк», выход 2, 5 минут пешком. Вход со двора, у вывески SHIFT.',
                'phone' => '+7 (495) 555-01-24',
                'email' => 'hello@shift-club.example',
                'latitude' => 55.75580,
                'longitude' => 37.61760,
                'hours' => json_encode([
                    ['label' => 'Игровые залы', 'value' => 'Ежедневно, круглосуточно'],
                    ['label' => 'Администратор', 'value' => 'На смене 24/7'],
                    ['label' => 'Бар и кухня', 'value' => 'Ежедневно с 10:00 до 04:00'],
                    ['label' => 'Турниры', 'value' => 'Пятница и суббота, с 19:00'],
                ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            foreach (['zones', 'tariffs', 'workstations'] as $table) {
                DB::statement("SELECT setval(pg_get_serial_sequence(?, 'id'), (SELECT MAX(id) FROM ".$table.'))', [$table]);
            }
        });
    }
}
