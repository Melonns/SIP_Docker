<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblSite extends Model
{
    use HasFactory;

    protected $table = 'sites';
    protected $primaryKey = 'id_site';

    protected $fillable = [
        'nama_site',
        'alamat',
        'latitude',
        'longitude',
        'radius_meter',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function mahasiswa()
    {
        return $this->hasMany(TblMahasiswa::class, 'id_site', 'id_site');
    }

    public function settingAbsensi()
    {
        return $this->hasMany(TblSettingAbsensi::class, 'id_site', 'id_site');
    }
}
