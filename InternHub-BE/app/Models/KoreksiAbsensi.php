<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\TblMahasiswa;

class KoreksiAbsensi extends Model
{
    use HasFactory;

    protected $table = 'attendance_corrections';
    protected $primaryKey = 'id_koreksi';

    protected $fillable = [
        'user_id',
        'id_mahasiswa',
        'jenis_koreksi',
        'tanggal',
        'jam_koreksi',
        'alasan',
        'lampiran',
        'status',
        'status_mentor',
        'status_admin',
        'catatan_mentor',
        'catatan_admin',
        'approved_by',
        'approved_by_mentor',
        'approved_by_admin',
        'catatan_approval',
        'approved_at',
        'approved_at_mentor',
        'approved_at_admin',
    ];

    protected $casts = [
        'tanggal' => 'date:Y-m-d',
        'approved_at' => 'datetime',
        'approved_at_mentor' => 'datetime',
        'approved_at_admin' => 'datetime',
    ];

    /**
     * Relasi ke User (pengaju koreksi)
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke profile mahasiswa (preferred)
     */
    public function mahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'id_mahasiswa', 'id_mahasiswa');
    }

    /**
     * Relasi ke User (approver)
     */
    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by', 'user_id');
    }

    /**
     * Scope that prefers profile FK (id_mahasiswa) but falls back to user_id
     */
    public function scopeForUser($query, $user)
    {
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        if ($mahasiswaId) {
            return $query->where('id_mahasiswa', $mahasiswaId);
        }
        return $query->where('user_id', $user->user_id);
    }

    /**
     * Relasi ke User (approver mentor)
     */
    public function approverMentor()
    {
        return $this->belongsTo(User::class, 'approved_by_mentor', 'user_id');
    }

    /**
     * Relasi ke User (approver admin)
     */
    public function approverAdmin()
    {
        return $this->belongsTo(User::class, 'approved_by_admin', 'user_id');
    }

    /**
     * Scope untuk filter berdasarkan status
     */
    public function scopeStatus($query, $status)
    {
        return $query->where('status', $status);
    }

}
