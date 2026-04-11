<?php

namespace Database\Seeders;

use App\Models\CertificateTemplate;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class CertificateTemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Pastikan direktori ada
        if (!Storage::disk('public')->exists('certificates')) {
            Storage::disk('public')->makeDirectory('certificates');
        }

        // Template Depan
        $frontImage = 'certificates/depan.jpeg';
        if (Storage::disk('public')->exists($frontImage)) {
            CertificateTemplate::updateOrCreate(
                ['side' => 'front', 'name' => 'Sertifikat Internship - Depan'],
                [
                    'image_path' => $frontImage,
                    'created_by' => null,
                    'updated_by' => null,
                ]
            );
            echo "✓ Template Depan berhasil disimpan\n";
        } else {
            echo "⚠ File certificates/depan.png tidak ditemukan di storage/app/public\n";
        }

        // Template Belakang
        $backImage = 'certificates/belakang.jpeg';
        if (Storage::disk('public')->exists($backImage)) {
            CertificateTemplate::updateOrCreate(
                ['side' => 'back', 'name' => 'Sertifikat Internship - Belakang'],
                [
                    'image_path' => $backImage,
                    'created_by' => null,
                    'updated_by' => null,
                ]
            );
            echo "✓ Template Belakang berhasil disimpan\n";
        } else {
            echo "⚠ File certificates/belakang.png tidak ditemukan di storage/app/public\n";
        }
    }
}
