<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     * Middleware untuk cek role user (support multiple roles)
     * 
     * Usage: middleware('role:admin,mentor') atau middleware('role:intern')
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        if (!auth()->check()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        $user = auth()->user();

        // Cek apakah user memiliki salah satu role yang dileave_requestskan
        if (!$user->hasAnyRole($roles)) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki role yang diperlukan.',
                'required_roles' => $roles,
                'your_roles' => $user->getRoleNames()
            ], 403);
        }

        return $next($request);
    }
}
