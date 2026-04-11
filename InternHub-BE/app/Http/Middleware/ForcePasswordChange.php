<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordChange
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();
        $excludedRoutes = [
            'password.change',
            'logout',
        ];
        if (!$request->routeIs($excludedRoutes) && $user->must_change_password) {
            return redirect()->route('password.change')
                ->with('warning', 'Demi keamanan, Anda wajib mengganti password default sebelum melanjutkan.');
        }
        return $next($request);
    }
}
