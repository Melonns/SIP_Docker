<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblAbsensi extends Model
{
    use HasFactory;

    protected $table = 'attendances';
    protected $primaryKey = 'id_absensi';

    protected $fillable = [
        'id_mahasiswa',
        'user_id',
        'status',
        'waktu',
        'tanggal',
        'latitude_absen',
        'longitude_absen',
        'foto_absen',
        'lama_telat',
        'early',
        'remark',
        'reason',
    ];

    protected $casts = [
        'tanggal' => 'date:Y-m-d',
        'early' => 'boolean',
    ];

    public function mahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'id_mahasiswa', 'id_mahasiswa');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
