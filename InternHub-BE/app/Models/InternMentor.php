<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InternMentor extends Model
{
    use HasFactory;

    protected $table = 'intern_mentors';

    protected $fillable = [
        'intern_id',
        'mentor_id',
        'intern_user_id',
        'mentor_user_id',
        'assigned_date',
        'end_date',
        'is_active',
    ];

    protected $casts = [
        'assigned_date' => 'date',
        'end_date' => 'date',
        'is_active' => 'boolean',
    ];

    /**
     * Prepare a date for array / JSON serialization.
     */
    protected function serializeDate(\DateTimeInterface $date)
    {
        return $date->format('Y-m-d');
    }

    /**
     * Relasi ke Mahasiswa (intern) — canonical for full-refactor
     */
    public function intern()
    {
        return $this->belongsTo(TblMahasiswa::class, 'intern_id', 'id_mahasiswa');
    }

    /**
     * Relasi ke Karyawan (mentor) — canonical for full-refactor
     */
    public function mentor()
    {
        return $this->belongsTo(TblKaryawan::class, 'mentor_id', 'id_karyawan');
    }

    /**
     * Legacy user relations (kept for compatibility where code still expects User)
     */
    public function internMahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'intern_id', 'id_mahasiswa');
    }

    public function mentorKaryawan()
    {
        return $this->belongsTo(TblKaryawan::class, 'mentor_id', 'id_karyawan');
    }

    public function internUser()
    {
        return $this->belongsTo(User::class, 'intern_id', 'user_id');
    }

    public function mentorUser()
    {
        return $this->belongsTo(User::class, 'mentor_id', 'user_id');
    }
}
