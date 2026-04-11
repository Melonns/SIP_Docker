<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Traits\HasScopedPermissions;

use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasScopedPermissions, SoftDeletes;

    protected $table = 'users';
    protected $primaryKey = 'user_id';

    /**
     * Channel notifikasi broadcast (Pusher) untuk user ini.
     * Menggunakan role-specific ID untuk menghindari tabrakan ID antara mahasiswa dan karyawan.
     */
    public function receivesBroadcastNotificationsOn(): string
    {
        return 'App.Models.User.' . $this->user_id;
    }

    /**
     * The attributes that are mass assignable.
     * 
     * Users table hanya untuk login, profile data di students/tbl_admin
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'password',
        'must_change_password',
        'level',
        'nama',
        'email',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'password' => 'hashed',
    ];

    // ==================== RELATIONSHIPS ====================

    /**
     * Relasi many-to-many ke Role (Overlap Model)
     * Satu user bisa memiliki banyak role
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_user', 'user_id', 'role_id')
            ->withTimestamps();
    }

    /**
     * Relasi many-to-many ke Permission (Granular Access Control)
     */
    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'permission_user', 'user_id', 'permission_id')
            ->withPivot('is_granted')
            ->withTimestamps();
    }

    /**
     * Get site from profile (mahasiswa or karyawan)
     * Replaces the direct relationship since users table doesn't have id_site
     *
     * Note: This is an accessor, so use $user->site
     */
    public function getSiteAttribute()
    {
        return $this->mahasiswa?->site ?? $this->karyawan?->site ?? null;
    }

    /**
     * Relasi ke Mahasiswa Profile (untuk Intern)
     */
    public function mahasiswa()
    {
        return $this->hasOne(TblMahasiswa::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Karyawan Profile (untuk Admin/Mentor)
     */
    public function karyawan()
    {
        return $this->hasOne(TblKaryawan::class, 'user_id', 'user_id');
    }

    /**
     * Nama attribute getter (prefers profile tables)
     */
    public function getNamaAttribute()
    {
        return $this->mahasiswa?->nama ?? $this->karyawan?->nama ?? $this->attributes['nama'] ?? null;
    }

    /**
     * Relasi ke Absensi
     */
    public function absensi()
    {
        return $this->hasMany(TblAbsensi::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Logbook
     */
    public function logbooks()
    {
        return $this->hasMany(Logbook::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Izin
     */
    public function leave_requests()
    {
        return $this->hasMany(Izin::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Koreksi Absensi
     */
    public function koreksiAbsensi()
    {
        return $this->hasMany(KoreksiAbsensi::class, 'user_id', 'user_id');
    }

    /**
     * Relasi ke Mentor (untuk Intern)
     * Returns User models for the mentors of this intern.
     */
    public function mentors()
    {
        // Simplified relation using direct user_ids in junction table
        return $this->belongsToMany(User::class, 'intern_mentors', 'intern_user_id', 'mentor_user_id')
            ->wherePivot('is_active', true);
    }

    /**
     * Bridge relationship to InternMentor mapping (for WHERE HAS queries)
     */
    public function internMentorMappings()
    {
        return $this->hasManyThrough(
            InternMentor::class,
            TblMahasiswa::class,
            'user_id',      // Foreign key on students table
            'intern_id',    // Foreign key on intern_mentors table
            'user_id',      // Local key on users table
            'id_mahasiswa'  // Local key on students table
        )->where('intern_mentors.is_active', true);
    }

    /**
     * Relasi ke Intern (untuk Mentor)
     * Returns User models for the interns assigned to this mentor.
     */
    public function interns()
    {
        // Simplified relation using direct user_ids in junction table
        return $this->belongsToMany(User::class, 'intern_mentors', 'mentor_user_id', 'intern_user_id')
            ->wherePivot('is_active', true);
    }

    /**
     * Bridge relationship to InternMentor mapping (for WHERE HAS queries)
     */
    public function mentorInternMappings()
    {
        return $this->hasManyThrough(
            InternMentor::class,
            TblKaryawan::class,
            'user_id',      // Foreign key on employees table
            'mentor_id',    // Foreign key on intern_mentors table
            'user_id',      // Local key on users table
            'id_karyawan'   // Local key on employees table
        )->where('intern_mentors.is_active', true);
    }


    /**
     * Accessor: Work Schedule untuk Intern
     * Semua intern menggunakan work schedule yang is_active = true (global).
     */
    public function getWorkScheduleAttribute()
    {
        return WorkSchedule::getActive();
    }

    // ==================== ROLE HELPERS ====================

    /**
     * Cek apakah user memiliki role tertentu
     */
    public function hasRole($roleName): bool
    {
        return $this->roles()->where('name', $roleName)->exists();
    }

    /**
     * Cek apakah user memiliki role tertentu (Alias for hasRole)
     */
    public function checkHasRole($roleName): bool
    {
        return $this->hasRole($roleName);
    }

    /**
     * Cek apakah user memiliki salah satu role dari array
     */
    public function hasAnyRole(array $roleNames): bool
    {
        return $this->roles()->whereIn('name', $roleNames)->exists();
    }

    /**
     * Cek apakah user adalah Admin
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Cek apakah user adalah Mentor
     */
    public function isMentor(): bool
    {
        return $this->hasRole('mentor');
    }

    /**
     * Cek apakah user adalah Intern
     */
    public function isIntern(): bool
    {
        return $this->hasRole('intern');
    }

    /**
     * Get semua nama role yang dimiliki user
     */
    public function getRoleNames(): array
    {
        return $this->roles()->pluck('name')->toArray();
    }

    // ==================== PERMISSION HELPERS ====================

    /**
     * Cek apakah user memiliki permission tertentu (Role-based + Overrides)
     */
    public function hasPermission($permissionName): bool
    {
        return in_array($permissionName, $this->getGrantedPermissions());
    }

    /**
     * Cek apakah user memiliki salah satu permission dari array (Role-based + Overrides)
     */
    public function hasAnyPermission(array $permissionNames): bool
    {
        $granted = $this->getGrantedPermissions();
        foreach ($permissionNames as $name) {
            if (in_array($name, $granted)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get semua permission yang granted untuk user (dari role + user override)
     * Returns permission NAMES yang effective untuk display di frontend
     */
    /**
     * Runtime cache for permissions
     */
    protected $grantedPermissionsCache = null;

    /**
     * Get semua permission yang granted untuk user (dari role + user override)
     * Returns permission NAMES yang effective untuk display di frontend
     */
    public function getGrantedPermissions(): array
    {
        if ($this->grantedPermissionsCache !== null) {
            return $this->grantedPermissionsCache;
        }

        // Use getEffectivePermissions from HasScopedPermissions trait
        // which combines role-based and user-level overrides
        $this->grantedPermissionsCache = $this->getEffectivePermissions()
            ->filter(fn($p) => $p->effective === true)
            ->pluck('name')
            ->toArray();

        return $this->grantedPermissionsCache;
    }

    /**
     * Get permission names filtered by a specific active role.
     * Only returns permissions that are:
     * 1. Assigned to the SPECIFIC role (not union of all user's roles)
     * 2. Plus user-level overrides (is_granted=true) that are applicable to this role
     * 3. Minus user-level revokes (is_granted=false)
     */
    public function getPermissionsForRole(string $roleName): array
    {
        // Get the role object
        $role = $this->roles()->where('name', $roleName)->first();
        if (!$role) {
            return [];
        }

        // Get permission IDs assigned to THIS specific role only
        $rolePermissionIds = $role->permissions()->pluck('permissions.permission_id')->toArray();

        // Get user-level overrides
        $overrides = $this->permissions->mapWithKeys(function ($p) {
            return [$p->permission_id => (bool)$p->pivot->is_granted];
        })->toArray();

        // Build final list: start with role permissions, apply overrides
        $allPermIds = array_values(array_unique(array_merge($rolePermissionIds, array_keys($overrides))));
        $perms = \App\Models\Permission::whereIn('permission_id', $allPermIds)->get();

        return $perms->filter(function ($perm) use ($rolePermissionIds, $overrides, $roleName) {
            $inherited = in_array($perm->permission_id, $rolePermissionIds);
            $override = $overrides[$perm->permission_id] ?? null;

            // Effective: override wins, otherwise inherited
            $effective = $override !== null ? $override : $inherited;
            if (!$effective) return false;

            // Must be applicable to this role
            if ($perm->applicable_roles !== null && !in_array($roleName, $perm->applicable_roles)) {
                return false;
            }

            return true;
        })->pluck('name')->toArray();
    }

    /**
     * Grant permission ke user
     */
    public function grantPermission($permissionId): void
    {
        $this->permissions()->syncWithoutDetaching([
            $permissionId => ['is_granted' => true]
        ]);
    }

    /**
     * Revoke permission dari user
     */
    public function revokePermission($permissionId): void
    {
        $this->permissions()->syncWithoutDetaching([
            $permissionId => ['is_granted' => false]
        ]);
    }

    // ==================== IDENTIFIER HELPERS ====================

    /**
     * Get label untuk identifier (NIP/NIM) berdasarkan role
     */
    public function getIdentifierLabel(): string
    {
        if ($this->isIntern()) {
            return 'NIM';
        }
        return 'NIP';
    }

    /**
     * Accessor for identifier attribute to derive from related profile tables
     * (kept for backward compatibility with code that reads $user->identifier)
     */
    public function getIdentifierAttribute()
    {
        return $this->mahasiswa?->nim ?? $this->karyawan?->nip ?? null;
    }

    /**
     * Accessor for username to derive from profile or email if needed
     * (kept for backward compatibility)
     */
    public function getUsernameAttribute()
    {
        // Prefer mahasiswa/karyawan identifier, otherwise fallback to email
        return $this->mahasiswa?->nim ?? $this->karyawan?->nip ?? $this->email ?? null;
    }

    // ==================== SCOPES ====================

    /**
     * Scope untuk filter user aktif
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope untuk filter berdasarkan role
     */
    public function scopeWithRole($query, $roleName)
    {
        return $query->whereHas('roles', function ($q) use ($roleName) {
            $q->where('name', $roleName);
        });
    }
}
