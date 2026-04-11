<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Settings
    |--------------------------------------------------------------------------
    | Keep the same structure as the package default but override needed options
    */

    'show_warnings' => false,
    'public_path' => null,

    'options' => [
        'font_dir' => storage_path('fonts'),
        'font_cache' => storage_path('fonts'),
        'temp_dir' => storage_path('app/dompdf'),
        'chroot' => base_path(),
        'enable_remote' => true,
        'allowed_protocols' => [
            'data://' => ['rules' => []],
            'file://' => ['rules' => []],
            'http://' => ['rules' => []],
            'https://' => ['rules' => []],
        ],
    ],
];
