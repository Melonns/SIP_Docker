<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblKaryawan extends Model
{
    use HasFactory;

    protected $table = 'employees';
    protected $primaryKey = 'id_karyawan';

    protected $fillable = [
        'user_id',
        'nip',
        'nama',
        'email',
        'gender',
        'division',
        'division_id',
        'job_position',
        'status',
        'id_site',
        'no_telp', // retained for backward compatibility; sync won't populate it
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Division (dinormalisasi)
     */
    public function divisionModel()
    {
        return $this->belongsTo(\App\Models\Division::class, 'division_id', 'id_division');
    }

    /**
     * Relasi ke Site
     */
    public function site()
    {
        return $this->belongsTo(TblSite::class, 'id_site', 'id_site');
    }

    // Accessor: prefer normalized division name, fallback to legacy string
    public function getDivisionAttribute($value)
    {
        return $this->divisionModel?->name ?? $value;
    }

    /**
     * Relasi ke InternMentor (Mapping)
     */
    public function mentorMappings()
    {
        return $this->hasMany(InternMentor::class, 'mentor_id', 'id_karyawan')
                    ->where('is_active', true);
    }
}
