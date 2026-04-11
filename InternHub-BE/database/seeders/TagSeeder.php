<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Tag;

class TagSeeder extends Seeder
{
    /**
     * Seed data tag default untuk logbook.
     */
    public function run(): void
    {
        $tags = [
            ['nama' => 'Pengembangan Aplikasi',  'warna' => '#3B82F6'], // blue
            ['nama' => 'Pengujian & QA',          'warna' => '#10B981'], // emerald
            ['nama' => 'Desain UI/UX',            'warna' => '#8B5CF6'], // violet
            ['nama' => 'Dokumentasi',             'warna' => '#F59E0B'], // amber
            ['nama' => 'Rapat & Koordinasi',      'warna' => '#EF4444'], // red
            ['nama' => 'Penelitian',              'warna' => '#06B6D4'], // cyan
            ['nama' => 'Infrastruktur & DevOps',  'warna' => '#F97316'], // orange
            ['nama' => 'Analisis Data',           'warna' => '#EC4899'], // pink
            ['nama' => 'Pelatihan & Workshop',    'warna' => '#6366F1'], // indigo
            ['nama' => 'Lainnya',                 'warna' => '#6B7280'], // gray
        ];

        foreach ($tags as $tag) {
            Tag::firstOrCreate(['nama' => $tag['nama']], ['warna' => $tag['warna']]);
        }
    }
}
