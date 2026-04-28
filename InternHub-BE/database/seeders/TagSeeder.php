<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tag;

class TagSeeder extends Seeder
{
    /**
     * Seed data tag default untuk logbook aktivitas operasional.
     */
    public function run(): void
    {
        $tags = [
            ['nama' => 'Meeting & Coordination',  'warna' => '#EF4444'], // red
            ['nama' => 'Daily Operations',        'warna' => '#3B82F6'], // blue
            ['nama' => 'Training & Workshop',     'warna' => '#8B5CF6'], // violet
            ['nama' => 'Maintenance & Support',   'warna' => '#F97316'], // orange
            ['nama' => 'Project Work',            'warna' => '#10B981'], // emerald
            ['nama' => 'Documentation',           'warna' => '#F59E0B'], // amber
            ['nama' => 'Team Collaboration',      'warna' => '#06B6D4'], // cyan
            ['nama' => 'Other',                   'warna' => '#6B7280'], // gray
        ];

        foreach ($tags as $tag) {
            Tag::firstOrCreate(['nama' => $tag['nama']], ['warna' => $tag['warna']]);
        }
    }
}
