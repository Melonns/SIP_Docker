<?php

return [
    // Default site name used as fallback when mapping fails (optional)
    'default_site_name' => env('DEFAULT_SITE_NAME', null),

    // Mapping: target site name (partial match against sites.nama_site) => array of keywords
    // Keywords are matched case-insensitively against `division`, `department`, or `section` fields
    'patterns' => [
        'SIER' => [
            'sier',
            'manajemen kawasan',
            'kawasan sier',
            's.b.u. sier',
        ],
        'PIER' => [
            'pier',
        ],
        'IPAL' => [
            'ipal',
            'pengolahan air limbah',
        ],
        'Kantor Pemasaran S.B.U. Sier' => [
            'kantor pemasaran',
            'pemasaran',
            'marketing',
        ],
    ],
];