<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;

class ForgotPasswordController extends Controller
{
    /**
     * Request password reset - kirim email dengan token
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            // Untuk keamanan, tetap return success meski email tidak ditemukan
            return response()->json([
                'success' => true,
                'message' => 'Jika email terdaftar, kami telah mengirim link reset password.'
            ]);
        }

        // Generate token (6 digit angka)
        $token = str_pad(random_int(0, 99999), 5, '0', STR_PAD_LEFT);

        // Hapus token lama jika ada
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        // Simpan token baru
        DB::table('password_reset_tokens')->insert([
            'email' => $request->email,
            'token' => Hash::make($token),
            'created_at' => Carbon::now()
        ]);

        // Send reset-password email synchronously
        try {
            $resetUrl = config('app.frontend_url', 'http://localhost:3000') . '/reset-password?token=' . $token . '&email=' . urlencode($request->email);

            Mail::send('emails.reset-password', [
                'user' => $user,
                'token' => $token,
                'resetUrl' => $resetUrl,
            ], function ($message) use ($user) {
                $message->to($user->email);
                $message->subject('Reset Password - SIP');
            });

            return response()->json([
                'success' => true,
                'message' => 'Link reset password telah dikirim ke email Anda.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengirim email. Silakan coba lagi nanti.',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Reset password dengan token
     */
    /**
     * Reset password setelah token diverifikasi
     * POST: email, password, password_confirmation
     */
    public function resetPassword(Request $request)
    {
        // Merge confirm_password ke password_confirmation jika ada
        if ($request->has('confirm_password') && !$request->has('password_confirmation')) {
            $request->merge(['password_confirmation' => $request->confirm_password]);
        }

        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:6|confirmed',
        ]);

        // Pastikan token sudah diverifikasi sebelumnya
        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Token belum diverifikasi atau sudah kadaluarsa.'
            ], 400);
        }

        // Update password user
        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan.'
            ], 404);
        }

        // Cek agar password baru tidak sama dengan password saat ini
        if (Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Password baru tidak boleh sama dengan password lama.'
            ], 400);
        }

        $user->password = Hash::make($request->password);
        $user->must_change_password = false;
        $user->save();

        // Hapus token setelah digunakan
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        // Hapus semua token login user (logout dari semua device)
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil direset. Silakan login dengan password baru.'
        ]);
    }

    public function changePassword(Request $request)
    {
        // Support berbagai field names untuk konfirmasi password
        if ($request->has('confirm_password') && !$request->has('new_password_confirmation')) {
            $request->merge(['new_password_confirmation' => $request->confirm_password]);
        }
        if ($request->has('password_confirmation') && !$request->has('new_password_confirmation')) {
            $request->merge(['new_password_confirmation' => $request->password_confirmation]);
        }

        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        $user = $request->user();

        // Cek current password
        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password salah.'
            ], 400);
        }

        // Cek agar password baru tidak sama dengan password saat ini
        if (Hash::check($request->new_password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Password baru tidak boleh sama dengan password lama.'
            ], 400);
        }

        // Update password
        $user->password = Hash::make($request->new_password);
        $user->must_change_password = false;
        $user->save();

        // Hapus semua token login user (logout dari semua device)
        $user->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diubah. Silakan login kembali dengan password baru.'
        ]);
    }

    /**
     * Verify token (untuk cek apakah token valid sebelum show form reset)
     */
    public function verifyToken(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
        ]);

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'success' => false,
                'valid' => false,
                'message' => 'Token tidak valid.'
            ], 400);
        }

        if (!Hash::check($request->token, $resetRecord->token)) {
            return response()->json([
                'success' => false,
                'valid' => false,
                'message' => 'Token tidak valid.'
            ], 400);
        }

        // Cek expired
        $tokenCreatedAt = Carbon::parse($resetRecord->created_at);
        if ($tokenCreatedAt->addMinutes(10)->isPast()) {
            return response()->json([
                'success' => false,
                'valid' => false,
                'message' => 'Token sudah kadaluarsa.'
            ], 400);
        }

        return response()->json([
            'success' => true,
            'valid' => true,
            'message' => 'Token valid.',
            'expires_in' => $tokenCreatedAt->addHour()->diffForHumans()
        ]);
    }
}
