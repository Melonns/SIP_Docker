<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\TblMahasiswa;

class Logbook extends Model
{
    use HasFactory;

    protected $table = 'logbooks';
    protected $primaryKey = 'id_logbooks';

    protected $fillable = [
        'user_id',
        'id_mahasiswa',
        'tanggal',
        'deskripsi_kegiatan',
        'bukti_kegiatan',
        'status_verifikasi',
        'verified_by',
        'feedback',
        'verified_at',
        'revision_at',
        'revision_by',
        'submitted_at',
    ];

    protected $casts = [
        'tanggal' => 'date:Y-m-d',
        'verified_at' => 'datetime',
        'revision_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    /**
     * Relasi ke User (intern penulis logbooks)
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
     * Scope: prefer profile FK (id_mahasiswa) but fallback to user_id for legacy rows
     */
    public function scopeForUser($query, $user)
    {
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        if ($mahasiswaId) {
            // During rollout include both profile-backed rows and legacy user_id rows
            return $query->where(function($q) use ($mahasiswaId, $user) {
                $q->where('id_mahasiswa', $mahasiswaId)
                  ->orWhere('user_id', $user->user_id);
            });
        }
        return $query->where('user_id', $user->user_id);
    }

    /**
     * Relasi ke User (mentor verifikator)
     */
    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by', 'user_id');
    }

    /**
     * Scope untuk filter berdasarkan status verifikasi
     */
    public function scopeStatus($query, $status)
    {
        return $query->where('status_verifikasi', $status);
    }

    /**
     * Scope untuk filter draft
     */
    public function scopeDraft($query)
    {
        return $query->where('status_verifikasi', 'draft');
    }

    /**
     * Scope untuk filter pending
     */
    public function scopePending($query)
    {
        return $query->where('status_verifikasi', 'pending');
    }

    /**
     * Scope untuk filter verified
     */
    public function scopeVerified($query)
    {
        return $query->where('status_verifikasi', 'verified');
    }

    /**
     * Scope untuk filter revision_needed
     */
    public function scopeRevision($query)
    {
        return $query->where('status_verifikasi', 'revision_needed');
    }

    // ==================== ACCESSORS & MUTATORS ====================

    /**
     * Get bukti_kegiatan attribute
     * decodes JSON if array, or returns single string as array for backward compatibility
     */
    public function getBuktiKegiatanAttribute($value)
    {
        if (is_null($value)) return [];

        // Try decoding as JSON
        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        // Fallback for old single string data (backward compatibility)
        return empty($value) ? [] : [$value];
    }

    /**
     * Set bukti_kegiatan attribute
     * Encodes array to JSON
     */
    public function setBuktiKegiatanAttribute($value)
    {
        if (is_array($value)) {
            $this->attributes['bukti_kegiatan'] = json_encode($value);
        } else {
            // Handle if a single string is passed (rare but possible in legacy code)
            $this->attributes['bukti_kegiatan'] = $value;
        }
    }
}
