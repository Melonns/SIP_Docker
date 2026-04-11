<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     * Middleware untuk cek permission user (granular access control)
     * 
     * Usage: middleware('permission:attendance_recap,verify_logbooks')
     */
    public function handle(Request $request, Closure $next, ...$permissions): Response
    {
        if (!auth()->check()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        $user = auth()->user();

        // Cek apakah user memiliki salah satu permission yang dileave_requestskan
        if (!$user->hasAnyPermission($permissions)) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki permission yang diperlukan.',
                'required_permissions' => $permissions,
                'your_permissions' => $user->getGrantedPermissions()
            ], 403);
        }

        return $next($request);
    }
}
