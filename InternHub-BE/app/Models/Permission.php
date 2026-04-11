<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasFactory;

    protected $table = 'permissions';
    protected $primaryKey = 'permission_id';

    protected $fillable = [
        'name',
        'label',
        'group',
        'applicable_roles',
    ];

    protected $casts = [
        'applicable_roles' => 'array',
    ];

    /**
     * Check if this permission is applicable to a given role name.
     * null applicable_roles = applicable to ALL roles.
     */
    public function isApplicableToRole(?string $roleName): bool
    {
        if ($this->applicable_roles === null) {
            return true; // null = flexible, all roles
        }
        return in_array($roleName, $this->applicable_roles);
    }

    /**
     * Relasi many-to-many ke User (user-level overrides)
     */
    public function users()
    {
        return $this->belongsToMany(User::class, 'permission_user', 'permission_id', 'user_id')
            ->withPivot('is_granted')
            ->withTimestamps();
    }

    /**
     * Relasi many-to-many ke Role (role-level grants)
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'permission_role', 'permission_id', 'role_id')
            ->withTimestamps();
    }
}
