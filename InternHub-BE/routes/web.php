<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ForgotPasswordController;
use App\Http\Controllers\Api\UserController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Route::middleware(['auth'])->group(function () {

    // --- AREA BEBAS (Bisa diakses meski password masih default) ---
    // Route ini WAJIB diberi nama sesuai yang ada di "excludedRoutes" middleware tadi
    Route::post('/change-password', [ForgotPasswordController::class, 'changePassword'])->name('password.change');
    // Route logout biasanya sudah bawaan, pastikan namanya 'logout'


    // --- AREA TERKUNCI (Wajib ganti password dulu) ---
    // Pasang middleware 'force.change.password' di sini
    Route::middleware(['force.change.password'])->group(function () {
        
        Route::get('/dashboard', [DashboardController::class, 'getDashboardData'])->name('dashboard');
        Route::get('/users', [UserController::class, 'index']);
        // ... semua route fitur SIP lainnya taruh di sini
        
    });

});