<?php

namespace App\Policies;

use App\Models\User;

class UserPermissionPolicy
{
    /**
     * Validate that the provided permission ids are within the target user's role scope.
     * Returns an array of invalid permission ids (empty if all valid).
     *
     * @param User $actor The admin making the change
     * @param User $target The user whose permissions are being changed
     * @param array $permissionIds List of permission IDs intended to be set (grants or denies)
     * @return array Invalid permission IDs (outside scope)
     */
    public function validatePermissionsScope(User $actor, User $target, array $permissionIds): array
    {
        // Only admin can change other user's permissions (enforced elsewhere via middleware/roles)
        // Build the scope for the target user (union of all roles' permissions)
        $scope = $target->getRoleScopePermissionIds();

        // Compute invalid IDs
        $invalid = array_values(array_diff($permissionIds, $scope));

        return $invalid;
    }
}
