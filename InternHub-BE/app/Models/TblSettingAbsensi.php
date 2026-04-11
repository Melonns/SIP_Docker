<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblSettingAbsensi extends Model
{
    use HasFactory;

    protected $table = 'attendance_settings';
    protected $primaryKey = 'id_waktu';

    protected $fillable = [
        'mulai_absen',
        'akhir_absen',
        'id_site',
    ];

    public function site()
    {
        return $this->belongsTo(TblSite::class, 'id_site', 'id_site');
    }
}
