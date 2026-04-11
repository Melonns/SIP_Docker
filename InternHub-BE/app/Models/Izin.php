<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\TblMahasiswa;

class Izin extends Model
{
    use HasFactory;

    protected $table = 'izin';
    protected $primaryKey = 'id_izin';

    protected $fillable = [
        'user_id',
        'id_mahasiswa',
        'jenis_izin',
        'tanggal_mulai',
        'tanggal_selesai',
        'keterangan',
        'lampiran',
        'approved_by',
        'catatan_approval',
        'approved_at',
        'status_mentor',
        'status_admin',
        'catatan_mentor',
        'catatan_admin',
        'approved_by_mentor',
        'approved_by_admin',
        'approved_at_mentor',
        'approved_at_admin',
        'status',
    ];

    protected $casts = [
        'tanggal_mulai' => 'date:Y-m-d',
        'tanggal_selesai' => 'date:Y-m-d',
        'approved_at' => 'datetime',
    ];

    /**
     * Relasi ke User (pengaju izin)
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
     * Scope untuk filter berdasarkan status
     */
    public function scopeStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope untuk filter pending
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }
}
