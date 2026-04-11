<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblAlasan extends Model
{
    use HasFactory;

    protected $table = 'reasons';
    protected $primaryKey = 'id_alasan';

    protected $fillable = [
        'id_mahasiswa',
        'alasan',
        'tanggal',
    ];

    public function mahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'id_mahasiswa', 'id_mahasiswa');
    }
}
