<?php

namespace App\Models\Traits;

use App\Models\Permission;
use Illuminate\Support\Arr;

/**
 * Trait HasScopedPermissions
 *
 * Provides helper functions to deal with scoped permissions per role and per-user overrides.
 * - getEffectivePermissions(): returns Collection of permission models with 'effective' flag
 * - syncScopedPermissions(array $permissionIds): syncs user-level granted permissions,
 *   validating they are within the user's role scope (intersection enforcement)
 *
 * Notes on behavior:
 * - "Scope" for a user is the union of all permissions assigned to the user's roles.
 * - syncScopedPermissions will only persist permissions that are within the scope; if any provided
 *   permission id is outside the scope, the method will throw \InvalidArgumentException.
 */
trait HasScopedPermissions
{
    /**
     * Collect permission ids available to this user via their roles (union of role permissions)
     *
     * @return array
     */
    public function getRoleScopePermissionIds(): array
    {
        return $this->roles()
            ->with('permissions')
            ->get()
            ->pluck('permissions')
            ->flatten(1)
            ->pluck('permission_id')
            ->unique()
            ->values()
            ->toArray();
    }

    /**
     * Get effective permissions for user as Permission models with additional 'effective' flag
     * - user override (permission_user.is_granted) wins over role inheritance
     *
     * @return \Illuminate\Support\Collection
     */
    public function getEffectivePermissions()
    {
        $roleScope = $this->getRoleScopePermissionIds();

        // Load all permissions that are either in role scope or explicitly overridden
        $overrideIds = $this->permissions()->pluck('permissions.permission_id')->toArray();

        $permissionIds = array_values(array_unique(array_merge($roleScope, $overrideIds)));

        $perms = Permission::with('roles')->whereIn('permission_id', $permissionIds)->get();

        // map overrides
        $overridesMap = $this->permissions->mapWithKeys(function ($p) {
            return [$p->permission_id => (bool)$p->pivot->is_granted];
        })->toArray();

        return $perms->map(function ($perm) use ($roleScope, $overridesMap) {
            $inherited = in_array($perm->permission_id, $roleScope);
            $override = array_key_exists($perm->permission_id, $overridesMap) ? $overridesMap[$perm->permission_id] : null;
            $effective = $override !== null ? $override : $inherited;

            $perm->effective = (bool)$effective;
            $perm->user_override = $override;
            return $perm;
        });
    }

    /**
     * Sync user permissions but ensure they are within the role scope.
     * Accepts either array of ids (grant these) or associative array id => is_granted.
     * Throws InvalidArgumentException if any provided id is outside user's role scope.
     *
     * @param array $permissions
     * @return void
     * @throws \InvalidArgumentException
     */
    public function syncScopedPermissions(array $permissions): void
    {
        // Normalize: if provided as simple id list -> convert to map id=>true
        $map = [];
        if (empty($permissions)) {
            $map = [];
        } else {
            $first = Arr::first($permissions);
            if (is_int($first) || is_string($first)) {
                // simple list of IDs
                foreach ($permissions as $id) {
                    $map[(int)$id] = ['is_granted' => true];
                }
            } else {
                // assume array of ['permission_id' => X, 'is_granted' => bool]
                foreach ($permissions as $p) {
                    $pid = (int)($p['permission_id'] ?? $p[0] ?? null);
                    $is = isset($p['is_granted']) ? (bool)$p['is_granted'] : true;
                    $map[$pid] = ['is_granted' => $is];
                }
            }
        }

        // Validate against role scope
        $allowed = $this->getRoleScopePermissionIds();
        $providedIds = array_keys($map);
        $invalid = array_diff($providedIds, $allowed);
        if (!empty($invalid)) {
            throw new \InvalidArgumentException('Some permissions are outside the role scope: ' . implode(',', $invalid));
        }

        // Sync: we will upsert only the provided overrides (this means missing overrides are removed -> inherit)
        $this->permissions()->sync($map);
    }
}
