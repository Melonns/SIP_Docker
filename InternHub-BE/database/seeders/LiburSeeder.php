<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Libur;

class LiburSeeder extends Seeder
{
    public function run(): void
    {
        // Hari libur nasional 2026 dari sumber APIHariLibur_V2
        $liburList = [
            [ 'tanggal' => '2026-01-01', 'keterangan' => 'Hari Tahun Baru' ],
            [ 'tanggal' => '2026-01-16', 'keterangan' => 'Isra Mikraj Nabi Muhammad' ],
            [ 'tanggal' => '2026-02-16', 'keterangan' => 'Cuti Bersama Tahun Baru Imlek' ],
            [ 'tanggal' => '2026-02-17', 'keterangan' => 'Tahun Baru Imlek' ],
            [ 'tanggal' => '2026-03-18', 'keterangan' => 'Cuti Bersama Hari Suci Nyepi (Tahun Baru Saka)' ],
            [ 'tanggal' => '2026-03-19', 'keterangan' => 'Hari Suci Nyepi (Tahun Baru Saka)' ],
            [ 'tanggal' => '2026-03-20', 'keterangan' => 'Cuti Bersama Idul Fitri' ],
            [ 'tanggal' => '2026-03-21', 'keterangan' => 'Hari Idul Fitri (belum pasti)' ],
            [ 'tanggal' => '2026-03-23', 'keterangan' => 'Cuti Bersama Idul Fitri' ],
            [ 'tanggal' => '2026-03-24', 'keterangan' => 'Cuti Bersama Idul Fitri' ],
            [ 'tanggal' => '2026-04-03', 'keterangan' => 'Wafat Isa Almasih' ],
            [ 'tanggal' => '2026-04-05', 'keterangan' => 'Hari Paskah' ],
            [ 'tanggal' => '2026-05-01', 'keterangan' => 'Hari Buruh Internasional / Pekerja' ],
            [ 'tanggal' => '2026-05-14', 'keterangan' => 'Kenaikan Isa Al Masih' ],
            [ 'tanggal' => '2026-05-15', 'keterangan' => 'Cuti Bersama Kenaikan Isa Al Masih' ],
            [ 'tanggal' => '2026-05-27', 'keterangan' => 'Idul Adha (Lebaran Haji) (belum pasti)' ],
            [ 'tanggal' => '2026-05-28', 'keterangan' => 'Idul Adha (Lebaran Haji)' ],
            [ 'tanggal' => '2026-05-31', 'keterangan' => 'Hari Raya Waisak (belum pasti)' ],
            [ 'tanggal' => '2026-06-01', 'keterangan' => 'Hari Lahir Pancasila' ],
            [ 'tanggal' => '2026-06-16', 'keterangan' => 'Satu Muharam / Tahun Baru Hijriah (belum pasti)' ],
            [ 'tanggal' => '2026-08-17', 'keterangan' => 'Hari Proklamasi Kemerdekaan R.I.' ],
            [ 'tanggal' => '2026-08-25', 'keterangan' => 'Maulid Nabi Muhammad (belum pasti)' ],
            [ 'tanggal' => '2026-12-24', 'keterangan' => 'Cuti Bersama Natal (Malam Natal)' ],
            [ 'tanggal' => '2026-12-25', 'keterangan' => 'Hari Raya Natal' ],
        ];
        foreach ($liburList as $libur) {
            Libur::updateOrCreate(['tanggal' => $libur['tanggal']], $libur);
        }
    }
}
