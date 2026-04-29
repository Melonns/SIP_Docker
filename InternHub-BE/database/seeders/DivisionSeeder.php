<?php

namespace Database\Seeders;

use App\Models\Division;
use App\Models\TblSite;
use Illuminate\Database\Seeder;

class DivisionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get default site
        $site = TblSite::first();
        if (!$site) {
            $this->command->warn('Site tidak ditemukan. Buat site terlebih dahulu.');
            return;
        }

        $divisions = [
            [
                'name' => 'Manajemen Kawasan SIER',
                'slug' => 'manajemen-kawasan-sier',
            ],
            [
                'name' => 'Sumber Daya Manusia',
                'slug' => 'sumber-daya-manusia',
            ],
            [
                'name' => 'Satuan Pengawas Intern',
                'slug' => 'satuan-pengawas-intern',
            ],
            [
                'name' => 'Manajemen Kawasan PIER',
                'slug' => 'manajemen-kawasan-pier',
            ],
            [
                'name' => 'Pengembangan',
                'slug' => 'pengembangan',
            ],
            [
                'name' => 'Logistik',
                'slug' => 'logistik',
            ],
            [
                'name' => 'Sekretaris Perusahaan',
                'slug' => 'sekretaris-perusahaan',
            ],
            [
                'name' => 'Pengawasan Operasional dan Kesehatan, Keselamatan dan Lingkungan',
                'slug' => 'pengawasan-operasional-dan-kesehatan-keselamatan-dan-lingkungan',
            ],
            [
                'name' => 'Pemasaran',
                'slug' => 'pemasaran',
            ],
            [
                'name' => 'Teknologi Informasi dan Komunikasi',
                'slug' => 'teknologi-informasi-dan-komunikasi',
            ],
            [
                'name' => 'Umum dan Pengadaan',
                'slug' => 'umum-dan-pengadaan',
            ],
            [
                'name' => 'Keuangan, Akuntansi dan Manajemen Risiko',
                'slug' => 'keuangan-akuntansi-dan-manajemen-risiko',
            ],
            [
                'name' => 'Jasa Penunjang',
                'slug' => 'jasa-penunjang',
            ],
            [
                'name' => 'Hukum',
                'slug' => 'hukum',
            ],
        ];

        foreach ($divisions as $division) {
            Division::firstOrCreate(
                ['slug' => $division['slug']],
                [
                    'name' => $division['name'],
                    'slug' => $division['slug'],
                    'site_id' => $site->id_site,
                ]
            );
        }

        $this->command->info('✓ Division seeder completed. ' . count($divisions) . ' divisions created/updated.');
    }
}
