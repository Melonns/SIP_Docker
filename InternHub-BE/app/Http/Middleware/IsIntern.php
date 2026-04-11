<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IsIntern
{
    /**
     * Handle an incoming request.
     * Middleware untuk memastikan user adalah Intern
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!auth()->check()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        if (!auth()->user()->isIntern()) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya intern yang bisa melakukan aksi ini.'
            ], 403);
        }

        return $next($request);
    }
}
