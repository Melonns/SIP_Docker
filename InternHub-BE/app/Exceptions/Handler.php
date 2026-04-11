<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Handle unauthenticated user - return JSON for API
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        // Untuk API request, selalu return JSON
        // Cek: expectsJson, atau path dimulai dengan 'api/', atau request via ajax
        if ($request->expectsJson() || $request->is('api/*') || $request->is('api*') || $request->ajax()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Silakan login terlebih dahulu.',
            ], 401);
        }

        // Untuk web request (jika ada), redirect ke halaman utama
        return redirect('/');
    }
}
