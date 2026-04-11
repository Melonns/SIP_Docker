<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

use Illuminate\Database\Eloquent\SoftDeletes;

class TblMahasiswa extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'students';
    protected $primaryKey = 'id_mahasiswa';

    // Relasi ke User via user_id foreign key
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    // automatically append 'divisi' accessor to serialized model
    protected $appends = ['divisi'];

    protected $fillable = [
        'user_id',
        'nama',
        'universitas',
        'jurusan',
        'nim',
        'email',
        'mulai_magang',
        'akhir_magang',
        'alamat',
        'no_telp',
        'foto',
        'id_site',
        'jenjang_pendidikan',
        'nomor_darurat',
        'nama_kontak_darurat',
        'foto_ktm',
        'tempat_lahir',
        'tanggal_lahir',
        'gender',
        'nik',
        'semester',
        'bank_name',
        'bank_account_name',
        'bank_account_number',
        'bank_proof',
        'work_schedule_id',
        'job_position',
        'division',
        'division_id',
    ];

    // Relasi ke Site
    public function site()
    {
        return $this->belongsTo(TblSite::class, 'id_site', 'id_site');
    }

    // Relasi ke Division (normalized)
    public function divisionModel()
    {
        return $this->belongsTo(\App\Models\Division::class, 'division_id', 'id_division');
    }

    // Prefer normalized division name when available
    public function getDivisionAttribute($value)
    {
        return $this->divisionModel?->name ?? $value;
    }
    /**
     * Accessor: top-level 'divisi' (from profile field, not from user anymore)
     */
    public function getDivisiAttribute()
    {
        // Division is now stored in students, no longer in users table
        // This accessor is kept for backward compatibility and returns the student's division
        return $this->division;
    }

    // Relasi ke Absensi
    public function absensi()
    {
        return $this->hasMany(TblAbsensi::class, 'id_mahasiswa', 'id_mahasiswa');
    }

    // Relasi ke Kegiatan
    public function kegiatan()
    {
        return $this->hasMany(TblKegiatan::class, 'id_mahasiswa', 'id_mahasiswa');
    }

    // Relasi ke Alasan
    public function alasan()
    {
        return $this->hasMany(TblAlasan::class, 'id_mahasiswa', 'id_mahasiswa');
    }

    // Relasi ke Work Schedule
    public function workSchedule()
    {
        return $this->belongsTo(WorkSchedule::class, 'work_schedule_id', 'id');
    }

    /**
     * Relasi ke InternMentor (Mapping)
     */
    public function internMentors()
    {
        return $this->hasMany(InternMentor::class, 'intern_id', 'id_mahasiswa');
    }
}
