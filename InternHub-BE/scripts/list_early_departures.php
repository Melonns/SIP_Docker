<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\TblAbsensi;
use App\Models\User;

$rows = TblAbsensi::where('status', 'pulang')
    ->whereRaw("TIME(waktu) < '17:00:00'")
    ->orderBy('tanggal', 'desc')
    ->limit(100)
    ->get();

if ($rows->isEmpty()) {
    echo "No early departures found\n";
    exit(0);
}

foreach ($rows as $r) {
    $user = User::find($r->user_id);
    echo sprintf("%s | user_id=%s | name=%s | date=%s | waktu=%s\n", date('Y-m-d H:i:s'), $r->user_id, $user?->nama ?? '-', $r->tanggal, $r->waktu);
}
