<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\EvaluationComponentMaster;

class KomponenSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $komponens = [
            [
                'nama_komponen' => 'Integritas (etika, moral dan kesungguhan)'
            ],
            [
                'nama_komponen' => 'Ketepatan waktu dalam bekerja'
            ],
            [
                'nama_komponen' => 'Keahlian berdasarkan bidang ilmu'
            ],
            [
                'nama_komponen' => 'Kerjasama dalam tim'
            ],
            [
                'nama_komponen' => 'Komunikasi'
            ],
            [
                'nama_komponen' => 'Penggunaan teknologi informasi'
            ],
            [
                'nama_komponen' => 'Pengembangan diri'
            ],
        ];

        foreach ($komponens as $komponen) {
            EvaluationComponentMaster::create($komponen);
        }
    }
}
