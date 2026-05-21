<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$t = microtime(true);
$d = random_bytes(5 * 1024 * 1024); // 5MB
echo "Random bytes generated in " . (microtime(true) - $t) . "s\n";

$t = microtime(true);
$enc = \Illuminate\Support\Facades\Crypt::encryptString($d);
echo "Encryption took " . (microtime(true) - $t) . "s\n";

$t = microtime(true);
$dec = \Illuminate\Support\Facades\Crypt::decryptString($enc);
echo "Decryption took " . (microtime(true) - $t) . "s\n";
