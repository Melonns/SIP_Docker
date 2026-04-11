<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::select("SELECT user_id, tanggal, COUNT(*) AS cnt FROM logbooks GROUP BY user_id, tanggal HAVING cnt > 1 ORDER BY cnt DESC LIMIT 100");
if (empty($rows)) {
    echo "No duplicate logbook rows found\n";
    exit(0);
}

foreach ($rows as $r) {
    echo "user_id={$r->user_id} tanggal={$r->tanggal} count={$r->cnt}\n";
}
