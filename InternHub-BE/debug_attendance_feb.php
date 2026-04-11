<?php

use App\Models\TblAbsensi;
use Carbon\Carbon;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$userId = 4;
$start = '2026-02-01';
$end = '2026-02-28';

echo "Checking attendance for user $userId from $start to $end\n\n";

$records = TblAbsensi::where('user_id', $userId)
    ->whereBetween('tanggal', [$start, $end])
    ->orderBy('tanggal', 'desc')
    ->get();

echo "Total records found: " . $records->count() . "\n\n";

if ($records->count() === 0) {
    echo "⚠️ TIDAK ADA DATA ABSENSI UNTUK PERIODE INI!\n\n";
    
    // Check all dates in range
    echo "Checking all dates in range...\n";
    for ($d = Carbon::parse($start); $d->lte(Carbon::parse($end)); $d->addDay()) {
        $ds = $d->toDateString();
        $day = $d->format('l');
        echo "  $ds ($day)\n";
    }
    
    echo "\n\nChecking jika ada data absensi di bulan lain untuk user ini:\n";
    $allRecords = TblAbsensi::where('user_id', $userId)->get();
    echo "Total data absensi untuk user $userId: " . $allRecords->count() . "\n";
    
    if ($allRecords->count() > 0) {
        echo "\nData yang ada:\n";
        foreach ($allRecords->groupBy('tanggal')->take(10) as $date => $recs) {
            $dateStr = Carbon::parse($date)->toDateString();
            echo "  $dateStr: " . $recs->count() . " records\n";
        }
    }
} else {
    foreach ($records as $rec) {
        echo "Date: {$rec->tanggal} | Status: {$rec->status} | Time: {$rec->waktu}\n";
    }
}
