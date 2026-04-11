<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Permission;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        return response()->json(Permission::paginate($perPage));
    }

    public function show($id)
    {
        return response()->json(Permission::findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:permissions,name',
            'guard_name' => 'nullable|string|max:50'
        ]);

        $perm = Permission::create($data);
        return response()->json(['success' => true, 'data' => $perm], 201);
    }

    public function update(Request $request, $id)
    {
        $perm = Permission::findOrFail($id);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:permissions,name,' . $perm->id,
            'guard_name' => 'nullable|string|max:50'
        ]);

        $perm->update($data);
        return response()->json(['success' => true, 'data' => $perm]);
    }

    public function destroy($id)
    {
        $perm = Permission::findOrFail($id);
        $perm->delete();
        return response()->json(['success' => true]);
    }

    /**
     * Get list permissions for a specific role (by name)
     */
    public function getPermissionsByRole($roleName)
    {
        $role = \App\Models\Role::where('name', $roleName)->firstOrFail();
        
        // Get all permissions (grouped)
        $all = Permission::all()->groupBy('group');
        
        // Get permissions assigned to this role
        $assigned = $role->permissions()->pluck('permissions.permission_id')->toArray();

        $payload = [];
        foreach ($all as $group => $perms) {
            $payload[$group] = $perms->map(function ($p) use ($assigned) {
                return [
                    'permission_id' => $p->permission_id,
                    'name' => $p->name,
                    'label' => $p->label,
                    'is_assigned' => in_array($p->permission_id, $assigned),
                ];
            })->values();
        }

        return response()->json([
            'success' => true,
            'role' => $role->name,
            'data' => $payload
        ]);
    }
}
