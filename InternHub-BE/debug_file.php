<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Logbook;
use Illuminate\Support\Facades\Storage;

echo "Checking file...\n";

// Filename from user's URL
$filename = '1769655508_697accd490e7b_1. Form PKL-1A (Form Kesediaan Pembimbing).pdf';

// Find logbooks containing this file
$logbooks = Logbook::all();
$targetPath = null;
$logbooksId = null;

foreach ($logbooks as $logbooks) {
    if (is_array($logbooks->bukti_kegiatan)) {
        foreach ($logbooks->bukti_kegiatan as $path) {
            if (basename($path) === $filename) {
                $targetPath = $path;
                $logbooksId = $logbooks->id_logbooks;
                break 2;
            }
        }
    }
}

if (!$targetPath) {
    echo "ERROR: File not found in any Logbook DB record.\n";
    exit;
}

echo "Found in Logbook ID: $logbooksId\n";
echo "DB Path: $targetPath\n";

$relativePath = str_replace('storage/', '', $targetPath);
$fullPath = storage_path('app/public/' . $relativePath);

echo "Full Path: $fullPath\n";

if (!file_exists($fullPath)) {
    echo "ERROR: Physical file DOES NOT EXIST.\n";
    exit;
}

$size = filesize($fullPath);
echo "Size: " . $size . " bytes (" . round($size / 1024, 2) . " KB)\n";

if ($size === 0) {
    echo "CRITICAL: File is 0 bytes (Empty/Corrupt). Browser will FORCE DOWNLOAD.\n";
} else {
    echo "Mime Type (finfo): " . mime_content_type($fullPath) . "\n";
}
