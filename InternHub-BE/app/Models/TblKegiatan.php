<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblKegiatan extends Model
{
    use HasFactory;

    protected $table = 'activities';
    protected $primaryKey = 'id_kegiatan';

    protected $fillable = [
        'id_mahasiswa',
        'kegiatan',
        'waktu_awal',
        'waktu_akhir',
        'tanggal',
    ];

    public function mahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'id_mahasiswa', 'id_mahasiswa');
    }
}
