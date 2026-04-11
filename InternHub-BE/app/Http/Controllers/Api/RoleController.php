<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Role;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        return response()->json(Role::paginate($perPage));
    }

    public function show($id)
    {
        return response()->json(Role::findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'guard_name' => 'nullable|string|max:50'
        ]);

        $role = Role::create($data);
        return response()->json(['success' => true, 'data' => $role], 201);
    }

    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $role->id,
            'guard_name' => 'nullable|string|max:50'
        ]);

        $role->update($data);
        return response()->json(['success' => true, 'data' => $role]);
    }

    public function destroy($id)
    {
        $role = Role::findOrFail($id);
        $role->delete();
        return response()->json(['success' => true]);
    }

    /**
     * GET: list permissions for a role (grouped) and mark which are assigned
     */
    public function permissions(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $all = \App\Models\Permission::all()->groupBy('group');
        // Use fully qualified column name to avoid ambiguity in joins
        $assigned = $role->permissions()->pluck('permissions.permission_id')->toArray();

        $payload = [];
        foreach ($all as $group => $perms) {
            $payload[$group] = $perms->map(function ($p) use ($assigned, $role) {
                return [
                    'permission_id' => $p->permission_id,
                    'name' => $p->name,
                    'label' => $p->label,
                    'is_assigned' => in_array($p->permission_id, $assigned),
                    'is_applicable' => $p->isApplicableToRole($role->name),
                    'applicable_roles' => $p->applicable_roles,
                ];
            })->values();
        }

        return response()->json(['success' => true, 'data' => $payload]);
    }

    /**
     * PUT: sync permissions for a role
     */
    public function updatePermissions(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'integer|exists:permissions,permission_id',
        ]);

        // Validate: reject permissions not applicable to this role
        $requestedPerms = \App\Models\Permission::whereIn('permission_id', $request->permissions)->get();
        $rejected = $requestedPerms->filter(fn($p) => !$p->isApplicableToRole($role->name));

        if ($rejected->isNotEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Beberapa permission tidak dapat diassign ke role ini.',
                'rejected' => $rejected->map(fn($p) => [
                    'permission_id' => $p->permission_id,
                    'name' => $p->name,
                    'applicable_roles' => $p->applicable_roles,
                ])->values(),
            ], 422);
        }

        $role->permissions()->sync($request->permissions);

        // Invalidate cached role->permissions map
        \Illuminate\Support\Facades\Cache::forget('role_permissions_map');

        return response()->json(['success' => true, 'message' => 'Permissions updated']);
    }

    /**
     * GET: lightweight map of role => [permission_name, ...] (cached)
     */
    public function map(Request $request)
    {
        $map = \Illuminate\Support\Facades\Cache::rememberForever('role_permissions_map', function () {
            return Role::with('permissions')->get()->mapWithKeys(function ($role) {
                return [$role->name => $role->permissions->pluck('name')->values()];
            })->toArray();
        });

        return response()->json(['success' => true, 'data' => $map]);
    }

    /**
     * POST: import role => permission mapping (bulk sync)
     * Body: { "mapping": { "admin": ["view_dashboard", "manage_users"], ... } }
     */
    public function importMapping(Request $request)
    {
        $request->validate([
            'mapping' => 'required|array',
        ]);

        $mapping = $request->input('mapping');
        $errors = [];

        foreach ($mapping as $roleName => $permList) {
            $role = Role::where('name', $roleName)->first();
            if (! $role) {
                $errors[] = "Role not found: {$roleName}";
                continue;
            }

            if (!is_array($permList)) {
                $errors[] = "Permissions for {$roleName} must be an array";
                continue;
            }

            // Resolve permission names to IDs; ignore unknown permissions (collect error)
            $permIds = [];
            foreach ($permList as $pname) {
                $p = \App\Models\Permission::where('name', $pname)->first();
                if ($p) $permIds[] = $p->permission_id;
                else $errors[] = "Unknown permission: {$pname} (role: {$roleName})";
            }

            // Sync (even if empty array)
            $role->permissions()->sync(array_values(array_unique($permIds)));
        }

        // Invalidate cache after import
        \Illuminate\Support\Facades\Cache::forget('role_permissions_map');

        if (!empty($errors)) {
            return response()->json(['success' => false, 'message' => 'Import finished with errors', 'errors' => $errors], 207);
        }

        return response()->json(['success' => true, 'message' => 'Import successful']);
    }

    public function updateRole(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $role->id,
            'guard_name' => 'nullable|string|max:50'
        ]);

        $role->update($data);
        return response()->json(['success' => true, 'data' => $role]);
    }
}
