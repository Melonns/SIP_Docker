<?php

use Illuminate\Support\Facades\Route;

// Controllers
use App\Http\Controllers\Api\LoginController;
use App\Http\Controllers\Api\ForgotPasswordController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\AbsensiController;
use App\Http\Controllers\Api\IzinController;
use App\Http\Controllers\Api\LogbookController;
use App\Http\Controllers\Api\SiteController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\InternProfileController;
use App\Http\Controllers\Api\InternMentorController;
use App\Http\Controllers\Api\DivisionController;
use App\Http\Controllers\Api\MahasiswaController;
use App\Http\Controllers\Api\WorkScheduleController;
use App\Http\Controllers\Api\EvaluationController;
use App\Http\Controllers\Api\UserImportController;
use App\Http\Controllers\Api\SertifikatController;
use App\Http\Controllers\Api\TagController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// ==========================================================================
// PUBLIC ROUTES (Tidak memerlukan autentikasi)
// ==========================================================================

// --- Authentication ---
Route::post('/login', [LoginController::class, 'login']);
// Backward-compatible endpoint for external SSO gateway (accepts { usercode, password })
Route::post('/auth/login', [LoginController::class, 'login']);
// SSO bypass — menerima token dari SSO, verifikasi ke SSO_CREDENTIAL_URL, lalu login lokal
Route::get('/auth/sso', [LoginController::class, 'ssoBypass']);
Route::get('/server-time', [LoginController::class, 'serverTime']);

// --- Forgot Password ---
Route::post('/forgot-password', [ForgotPasswordController::class, 'forgotPassword']);




Route::post('/reset-password', [ForgotPasswordController::class, 'resetPassword']);
Route::post('/verify-reset-token', [ForgotPasswordController::class, 'verifyToken']);


// ==========================================================================
// PROTECTED ROUTES (Memerlukan autentikasi via Sanctum)
// ==========================================================================

Route::middleware('auth:sanctum')->group(function () {

    // --- Protected Data (Moved from public for security) ---
    Route::get('/mahasiswa', [MahasiswaController::class, 'index']);
    Route::get('/mahasiswa/{id}', [MahasiswaController::class, 'show'])->whereNumber('id');
    Route::get('/sites', [SiteController::class, 'index']);
    Route::get('/sites/{id}', [SiteController::class, 'show'])->whereNumber('id');

    // ----------------------------------------------------------------------
    // USER SESSION & PROFILE
    // ----------------------------------------------------------------------
    Route::get('/user', [LoginController::class, 'me']);
    Route::post('/logout', [LoginController::class, 'logout']);
    Route::get('/profile', [ProfileController::class, 'getProfile']);
    Route::post('/profile', [ProfileController::class, 'update']); // Use POST to support file uploads
    Route::get('/profile/photo', [ProfileController::class, 'getPhoto']);
    Route::get('/profile/ktm', [ProfileController::class, 'getKtm']);
    Route::get('/profile/bank-proof', [ProfileController::class, 'getBankProof']);

    Route::get('/users/{id}/foto', [AdminUserController::class, 'foto'])->middleware('permission:view_intern_profiles')->whereNumber('id');

    Route::post('/change-password', [ForgotPasswordController::class, 'changePassword']);

    // Division Routes
    Route::get('/available-divisions', [DivisionController::class, 'index'])->middleware('permission:view_user_role');
    Route::post('/sync-divisions-from-students', [DivisionController::class, 'syncFromStudents'])->middleware('permission:view_user_role');

    // Tags (semua auth user bisa list, untuk dipilih saat buat/edit logbook)
    Route::get('/tags', [TagController::class, 'index']);

    Route::get('/active-interns', [UserController::class, 'getActiveIntern'])->middleware('permission:view_intern_monitoring');
    Route::get('/done-interns', [UserController::class, 'getDoneIntern'])->middleware('permission:view_intern_monitoring');

    // ----------------------------------------------------------------------
    // DASHBOARD (Semua Role)
    // ----------------------------------------------------------------------
    Route::get('/dashboard', [DashboardController::class, 'getDashboardData'])->middleware('permission:view_dashboard');

    // ----------------------------------------------------------------------
    // ABSENSI (UC 001)
    // ----------------------------------------------------------------------
    Route::prefix('absensi')->group(function () {
        // Status & Info
        Route::get('/server-time', [AbsensiController::class, 'getServerTime']);
        Route::get('/status', [AbsensiController::class, 'statusHariIni']);
        Route::get('/cek-status', [AbsensiController::class, 'checkStatus']);
        Route::get('/user-site', [AbsensiController::class, 'getUserSite']);
        Route::get('/riwayat', [AbsensiController::class, 'riwayat']);
        Route::get('/calendar-dates', [AbsensiController::class, 'getAttendanceDates']);

        Route::get('/sites', [SiteController::class, 'index']);

        // Check-in & Check-out
        Route::post('/check-location', [AbsensiController::class, 'checkLocation']);
        Route::post('/masuk', [AbsensiController::class, 'absenMasuk']);
        Route::post('/pulang', [AbsensiController::class, 'absenPulang']);

        // Foto (Accepts User ID or Filename)
        Route::get('/foto-masuk/{param}', [AbsensiController::class, 'getImage'])->where('param', '.*')->name('absensi.foto-masuk');
        Route::get('/foto-pulang/{param}', [AbsensiController::class, 'getImagePulang'])->where('param', '.*')->name('absensi.foto-pulang');

        // Legacy/Raw route
        Route::get('/foto/{filename}/raw', [AbsensiController::class, 'getFotoAbsensiRaw'])->where('filename', '.*');
        Route::get('/foto/{filename}', [AbsensiController::class, 'getFotoAbsensiRaw'])->where('filename', '.*'); // Alias without /raw
    });

    // ----------------------------------------------------------------------
    // NOTIFICATIONS
    // ----------------------------------------------------------------------
    Route::prefix('notifications')->group(function () {
        Route::get('/', [App\Http\Controllers\Api\NotificationController::class, 'index']);
        Route::get('/unread-count', [App\Http\Controllers\Api\NotificationController::class, 'unreadCount']);
        Route::put('/mark-all-read', [App\Http\Controllers\Api\NotificationController::class, 'markAllAsRead']);
        Route::put('/{id}/read', [App\Http\Controllers\Api\NotificationController::class, 'markAsRead'])->whereUuid('id');
        Route::delete('/', [App\Http\Controllers\Api\NotificationController::class, 'destroyAll']);
        Route::delete('/{id}', [App\Http\Controllers\Api\NotificationController::class, 'destroy'])->whereUuid('id');
    });

    // ----------------------------------------------------------------------
    // IZIN & KOREKSI (UC 002)
    // ----------------------------------------------------------------------
    Route::prefix('izin')->group(function () {
        // List & Create
        Route::get('/', [IzinController::class, 'index']);
        Route::post('/', [IzinController::class, 'store']);

        // View Lampiran (static route HARUS sebelum parameter route)
        Route::get('/view-lampiran/{id}/{index}', [IzinController::class, 'viewLampiran'])->whereNumber('id');

        // Detail & Download (parameter route)
        Route::get('/{id}', [IzinController::class, 'show'])->whereNumber('id');
        Route::get('/{id}/download-lampiran/{index?}', [IzinController::class, 'downloadLampiran'])->whereNumber('id');
    });

    Route::prefix('koreksi')->group(function () {
        // List & Create
        Route::get('/', [IzinController::class, 'koreksiIndex']);
        Route::post('/', [IzinController::class, 'koreksiStore']);

        // View Lampiran (static route HARUS sebelum parameter route)
        Route::get('/view-lampiran/{id}/{index}', [IzinController::class, 'viewLampiranKoreksi'])->whereNumber('id');

        // Detail & Download (parameter route)
        Route::get('/{id}', [IzinController::class, 'koreksiShow'])->whereNumber('id');
        Route::get('/{id}/download-lampiran/{index?}', [IzinController::class, 'downloadLampiranKoreksi'])->whereNumber('id');
    });

    // ----------------------------------------------------------------------
    // LOGBOOK (UC 007)
    // ----------------------------------------------------------------------
    Route::prefix('logbook')->group(function () {
        Route::get('/', [LogbookController::class, 'index']);
        Route::post('/', [LogbookController::class, 'store']);
        // Specific routes MUST come before generic {id} route
        Route::get('/{id}/file/{filename}', [LogbookController::class, 'getFile'])->where('filename', '.*')->whereNumber('id'); // Allow dots in filename
        Route::get('/summary/{id}', [UserController::class, 'getInternDailySummary'])->whereNumber('id');
        // Generic {id} route LAST
        Route::get('/{id}', [LogbookController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [LogbookController::class, 'update'])->whereNumber('id');
        Route::post('/{id}', [LogbookController::class, 'update'])->whereNumber('id'); // Fallback for multipart/form-data
        Route::delete('/{id}', [LogbookController::class, 'destroy'])->whereNumber('id');
    });

    // ----------------------------------------------------------------------
    // EVALUATION (Intern View)
    // ----------------------------------------------------------------------
    Route::get('/intern/my-evaluation', [EvaluationController::class, 'myEvaluation'])->middleware('permission:view_result_evaluation');

    Route::get('/users/{id}/permissions/effective', [UserController::class, 'getUserPermissionsEffective'])->whereNumber('id');

    // ----------------------------------------------------------------------
    // LEGACY ROUTES (Backward Compatibility)
    // ----------------------------------------------------------------------
    Route::get('/mahasiswa/{id}/absensi', [MahasiswaController::class, 'show_absensi'])->whereNumber('id');
    Route::get('/mahasiswa/{id}/kegiatan', [MahasiswaController::class, 'show_kegiatan'])->whereNumber('id');
    Route::get('/mahasiswa/{id}/foto', [InternProfileController::class, 'getPhoto'])->whereNumber('id');

    // ======================================================================
    // MENTOR ROUTES (Role: mentor, admin)
    // ======================================================================
    Route::prefix('mentor')->group(function () {

        // --- Dashboard ---
        Route::get('/dashboard', [DashboardController::class, 'getDashboardData'])->middleware('permission:view_dashboard');

        // --- Interns Management ---
        Route::get('/interns', [UserController::class, 'getMyInterns'])->middleware('permission:view_intern_monitoring');
        Route::get('/interns/ending-soon', [DashboardController::class, 'mentorEndingSoon'])->middleware('permission:view_intern_monitoring'); // Static HARUS sebelum {id}
        Route::get('/interns/{id}/attendance', [UserController::class, 'getInternAttendanceDetail'])->middleware('permission:view_intern_monitoring')->whereNumber('id'); // Attendance detail with pagination
        Route::get('/interns/{id}/attendance-detail', [UserController::class, 'getInternAttendanceDetailComplete'])->middleware('permission:view_intern_monitoring')->whereNumber('id'); // Complete attendance detail with izin/sakit/koreksi
        Route::get('/interns/{id}/daily-summary', [UserController::class, 'getInternDailySummary'])->middleware('permission:view_intern_monitoring')->whereNumber('id'); // Combined attendance + logbooks
        Route::get('/interns/{id}/logbook-chart', [UserController::class, 'getInternLogbookChart'])->middleware('permission:view_intern_monitoring')->whereNumber('id'); // Logbook status chart
        Route::get('/interns/{id}/profile', [InternProfileController::class, 'show'])->middleware('permission:view_intern_monitoring')->whereNumber('id'); // Intern profile detail
        Route::get('/interns/{id}', [UserController::class, 'getInternDetails'])->middleware('permission:view_intern_monitoring')->whereNumber('id');

        // --- Logbook Verification ---
        Route::get('/logbook', [LogbookController::class, 'listForMentor'])->middleware('permission:view_logbook,view_intern_monitoring');
        Route::get('/logbook/progress', [LogbookController::class, 'progressForMentor'])->middleware('permission:view_logbook,view_intern_monitoring');
        Route::get('/logbook/user/{user_id}', [LogbookController::class, 'listByIntern'])->middleware('permission:view_logbook,view_intern_monitoring')->whereNumber('user_id');
        Route::post('/logbook/{id}/verify', [LogbookController::class, 'verify'])->middleware('permission:view_logbook,view_intern_monitoring')->whereNumber('id');

        // --- Izin & Koreksi Approval ---
        Route::get('/izin', [IzinController::class, 'listAll'])->middleware('permission:view_leave_request');
        Route::put('/izin/{id}/status', [IzinController::class, 'updateStatus'])->middleware('permission:view_leave_request')->whereNumber('id');
        Route::get('/koreksi', [IzinController::class, 'koreksiListAll'])->middleware('permission:view_correction');
        Route::put('/koreksi/{id}/status', [IzinController::class, 'koreksiUpdateStatus'])->middleware('permission:view_correction')->whereNumber('id');

        // --- Izin & Koreksi Approval (Alias for backward compatibility) ---
        Route::get('/izin', [IzinController::class, 'listAll'])->middleware('permission:view_leave_request');
        Route::put('/izin/{id}/status', [IzinController::class, 'updateStatus'])->middleware('permission:view_leave_request')->whereNumber('id');

        // --- Absensi Recap ---
        Route::get('/absensi/rekap', [AbsensiController::class, 'rekap'])->middleware('permission:view_logs');
        Route::get('/detail/{user_id}/{tanggal}', [AbsensiController::class, 'detailByUserTanggal'])->middleware('permission:view_logs')->whereNumber('user_id');

        // --- Filters & Metadata ---
        Route::get('/universitas', [UserController::class, 'getAvailableUniv']);
        Route::get('/mentors', [UserController::class, 'getAvailableMentor']);
        Route::get('/active-interns', [UserController::class, 'getActiveIntern']);
        Route::get('/filters', [SiteController::class, 'filters']);

        // --- Reports ---
        Route::prefix('reports')->middleware('permission:view_reports')->group(function () {
            Route::get('/attendance', [ReportController::class, 'exportAttendance']);
            Route::get('/logbook', [ReportController::class, 'exportLogbook']);
            Route::get('/assigned-interns', [ReportController::class, 'exportAssignedInterns']);
            Route::get('/internships', [ReportController::class, 'exportInternshipList']);
            Route::get('/filters', [ReportController::class, 'getFilters']);
        });

        // --- Evaluations ---
        Route::prefix('evaluations')->middleware('permission:view_input_evaluation')->group(function () {
            Route::get('/interns', [EvaluationController::class, 'listInterns']); // List interns with status
            Route::get('/ending-soon', [EvaluationController::class, 'endingSoon']); // Interns ending soon
            Route::get('/', [EvaluationController::class, 'index']);
            Route::post('/', [EvaluationController::class, 'store']);
            Route::get('/{id}', [EvaluationController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [EvaluationController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [EvaluationController::class, 'destroy'])->whereNumber('id');
            Route::get('/komponen-penilaian', [EvaluationController::class, 'getKomponenPenilaian']);
        });

        // --- Roles Management ---
        Route::middleware('permission:view_user_role')->group(function () {
            Route::get('/roles', [RoleController::class, 'index']);
            Route::post('/roles', [RoleController::class, 'store']);
            Route::get('/roles/{id}', [RoleController::class, 'show'])->whereNumber('id');
            Route::put('/roles/{id}', [RoleController::class, 'update'])->whereNumber('id');
            Route::delete('/roles/{id}', [RoleController::class, 'destroy'])->whereNumber('id');
        });

        // --- Permissions Management ---
        Route::middleware('permission:view_user_permissions')->group(function () {
            Route::get('/permissions', [PermissionController::class, 'index']);
            Route::post('/permissions', [PermissionController::class, 'store']);
            Route::get('/permissions/{id}', [PermissionController::class, 'show'])->whereNumber('id');
            Route::put('/permissions/{id}', [PermissionController::class, 'update'])->whereNumber('id');
            Route::delete('/permissions/{id}', [PermissionController::class, 'destroy'])->whereNumber('id');
        });

        // --- Users Management ---
        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::post('/users', [AdminUserController::class, 'store']);
            Route::get('/users/{id}', [AdminUserController::class, 'show'])->whereNumber('id');
            Route::put('/users/{id}', [AdminUserController::class, 'update'])->whereNumber('id');
            Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->whereNumber('id');
        });

        // --- Intern-Mentor Mapping ---
        Route::middleware('permission:view_intern_mapping')->group(function () {
            Route::get('/intern-mentor', [InternMentorController::class, 'index']);
            Route::post('/intern-mentor', [InternMentorController::class, 'store']);
            Route::get('/intern-mentor/{id}', [InternMentorController::class, 'show'])->whereNumber('id');
            Route::put('/intern-mentor/{id}', [InternMentorController::class, 'update'])->whereNumber('id');
            Route::delete('/intern-mentor/{id}', [InternMentorController::class, 'destroy'])->whereNumber('id');
        });

        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::post('/intern-profiles', [InternProfileController::class, 'storeProfile']); // Create mahasiswa profile (public, tanpa user)
            Route::get('/intern-profiles', [InternProfileController::class, 'index']);
            Route::get('/intern-profiles/{id}', [InternProfileController::class, 'show'])->whereNumber('id');
            Route::put('/intern-profiles/{id}', [InternProfileController::class, 'update'])->whereNumber('id');
            Route::post('/intern-profiles/{id}', [InternProfileController::class, 'update'])->whereNumber('id'); // Fallback for multipart/form-data
            Route::post('/intern-profiles/{id}/create-user', [InternProfileController::class, 'createUserForMahasiswa'])->whereNumber('id'); // Create user from mahasiswa
            Route::get('/intern-profiles/{id}/photo', [InternProfileController::class, 'getPhoto'])->whereNumber('id');
            Route::get('/intern-profiles/{id}/bank-proof', [InternProfileController::class, 'getBankProof'])->whereNumber('id'); // Get bank proof via endpoint
        });

    });

    // ======================================================================
    // ADMIN ROUTES (Role: admin only)
    // ======================================================================
    Route::group(['prefix' => 'admin'], function () {

        // --- Dashboard ---
        Route::get('/dashboard', [DashboardController::class, 'getDashboardData'])->middleware('permission:view_dashboard');
        Route::get('/dashboard/export', [DashboardController::class, 'exportAdmin'])->middleware('permission:view_reports');
        Route::get('/dashboard/export/package', [DashboardController::class, 'exportAdminPackage'])->middleware('permission:view_reports');

        // --- Interns Management ---
        Route::middleware('permission:view_intern_monitoring')->group(function () {
            Route::get('/interns', [UserController::class, 'getMyInterns']);
            Route::get('/interns/ending-soon', [DashboardController::class, 'adminEndingSoon']); // Static HARUS sebelum {id}
            Route::get('/interns/{id}/attendance', [UserController::class, 'getInternAttendanceDetail'])->whereNumber('id'); // Attendance detail with pagination
            Route::get('/interns/{id}/attendance-detail', [UserController::class, 'getInternAttendanceDetailComplete'])->whereNumber('id'); // Complete attendance detail with izin/sakit/koreksi
            Route::get('/interns/{id}/daily-summary', [UserController::class, 'getInternDailySummary'])->whereNumber('id'); // Combined attendance + logbooks
            Route::get('/interns/{id}/logbook-chart', [UserController::class, 'getInternLogbookChart'])->whereNumber('id'); // Logbook status chart
            Route::get('/interns/{id}/profile', [InternProfileController::class, 'show'])->whereNumber('id'); // Intern profile detail
            Route::get('/interns/{id}', [UserController::class, 'getInternDetails'])->whereNumber('id');
        });

        // --- Reports ---
        Route::prefix('reports')->middleware('permission:view_reports')->group(function () {
            Route::get('/mentors', [ReportController::class, 'exportMentorList']);
            Route::get('/internships', action: [ReportController::class, 'exportInternshipList']);
            Route::get('/attendance', [ReportController::class, 'exportAttendance']);
            Route::get('/logbook', [ReportController::class, 'exportLogbook']);
            Route::get('/allowance', [ReportController::class, 'exportAllowance']);
        });

        // --- Izin & Koreksi Approval ---
        Route::get('/izin', [IzinController::class, 'listAll'])->middleware('permission:view_leave_request');
        Route::put('/izin/{id}/status', [IzinController::class, 'updateStatus'])->middleware('permission:view_leave_request')->whereNumber('id');
        Route::get('/koreksi', [IzinController::class, 'koreksiListAll'])->middleware('permission:view_correction');
        Route::put('/koreksi/{id}/status', [IzinController::class, 'koreksiUpdateStatus'])->middleware('permission:view_correction')->whereNumber('id');

        // --- Absensi Recap ---
        Route::get('/absensi/rekap', [AbsensiController::class, 'rekap'])->middleware('permission:view_logs');

        // --- User Management ---
        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::post('/users', [AdminUserController::class, 'store']);
            Route::get('/users/{id}', [AdminUserController::class, 'show'])->whereNumber('id');
            Route::put('/users/{id}', [AdminUserController::class, 'update'])->whereNumber('id');
            Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->whereNumber('id');
            // --- User Import ---
            Route::get('/users/import/template', [UserImportController::class, 'downloadTemplate']);
            Route::post('/users/import/preview', [UserImportController::class, 'preview']);
            Route::post('/users/import', [UserImportController::class, 'import']);
            // --- User Management ---
            Route::delete('/users/{id}/force', [UserController::class, 'forceDelete'])->whereNumber('id');
            Route::put('/users/{id}/status', [UserController::class, 'updateStatus'])->whereNumber('id');
        });

        Route::put('/users/{id}/roles', [UserController::class, 'updateUserRoles'])->middleware('permission:view_user_role')->whereNumber('id');

        // --- Filters & Metadata ---
        Route::get('/universitas', [UserController::class, 'getAvailableUniv']);
        Route::get('/mentors', [UserController::class, 'getAvailableMentor']);
        Route::get('/active-interns', [UserController::class, 'getActiveIntern']);
        Route::get('/karyawan', [UserController::class, 'getKaryawan']);
        Route::get('/filters', [SiteController::class, 'filters']);

        // --- Role Management ---
        Route::middleware('permission:view_user_role')->group(function () {
            Route::get('/roles', [UserController::class, 'getRoles']);
            Route::get('/roles/permissions/map', [RoleController::class, 'map']);
            Route::post('/roles/permissions/import', [RoleController::class, 'importMapping']);
            Route::get('/roles/{id}/permissions', [RoleController::class, 'permissions'])->whereNumber('id');
            Route::put('/roles/{id}/permissions', [RoleController::class, 'updatePermissions'])->whereNumber('id');
        });

        // --- Permission Management ---
        Route::middleware('permission:view_user_permissions')->group(function () {
            Route::get('/permissions', [UserController::class, 'getPermissions']);
            Route::get('/permissions/role/{role_name}', [PermissionController::class, 'getPermissionsByRole']);
            Route::get('/users/{id}/permissions', [UserController::class, 'getUserPermissions'])->whereNumber('id');
            Route::get('/users/{id}/permissions/effective', [UserController::class, 'getUserPermissionsEffective'])->whereNumber('id');
            Route::put('/users/{id}/permissions', [UserController::class, 'updateUserPermissions'])->whereNumber('id');
        });

        // --- Intern-Mentor Mapping ---
        Route::middleware('permission:view_intern_mapping')->group(function () {
            Route::get('/intern-mentor/mentors', [InternMentorController::class, 'getMentorsList']);
            Route::get('/intern-mentor/unassigned', [InternMentorController::class, 'getUnassignedInterns']);
            Route::post('/intern-mentor/sync-employees', [InternMentorController::class, 'syncEmployees']);
            Route::get('/intern-mentor/export/pdf', [InternMentorController::class, 'exportPdf']);
            Route::get('/intern-mentor', [InternMentorController::class, 'getInternMentorMapping']);
            Route::post('/intern-mentor', [InternMentorController::class, 'assignInternToMentor']);
            Route::put('/intern-mentor/{id}', [InternMentorController::class, 'updateInternMentorMapping'])->whereNumber('id');
            Route::delete('/intern-mentor/{id}', [InternMentorController::class, 'removeInternMentorMapping'])->whereNumber('id');
            Route::post('/intern-mentor/sync-employees', [InternMentorController::class, 'syncEmployees']);
        });

        // --- Evaluation Components (Master Data) ---
        Route::prefix('evaluation-components')->middleware('permission:view_evaluation_component')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'store']);
            Route::get('/{id}', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'destroy'])->whereNumber('id');
            Route::post('/bulk-delete', [\App\Http\Controllers\Api\EvaluationComponentController::class, 'bulkDelete']);
        });

        // --- Evaluations (Admin) ---
        Route::prefix('evaluations')->middleware('permission:view_input_evaluation')->group(function () {
            Route::get('/dashboard', [EvaluationController::class, 'adminDashboard']); // Stats: total, done, need_review, not_yet
            Route::get('/interns', [EvaluationController::class, 'adminListInterns']); // List interns with admin review status
            Route::get('/ending-soon', [EvaluationController::class, 'endingSoon']); // Interns ending soon
            Route::put('/{id}/review', [EvaluationController::class, 'adminReview'])->whereNumber('id'); // Admin review evaluation
            Route::get('/', [EvaluationController::class, 'index']);
            Route::post('/', [EvaluationController::class, 'store']);
            Route::get('/{id}', [EvaluationController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [EvaluationController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [EvaluationController::class, 'destroy'])->whereNumber('id');
            Route::get('/komponen-penilaian', [EvaluationController::class, 'getKomponenPenilaian']);
        });

        // --- Certificate Management ---
        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::get('/sertifikat/data/{id}', [SertifikatController::class, 'getData'])->whereNumber('id');
            Route::post('/sertifikat/generate', [SertifikatController::class, 'generate']);
            Route::get('/sertifikat/templates', [SertifikatController::class, 'getTemplates']);
            Route::post('/sertifikat/templates', [SertifikatController::class, 'uploadTemplate']);
            Route::delete('/sertifikat/templates/{id}', [SertifikatController::class, 'deleteTemplate'])->whereNumber('id');
            Route::get('/sertifikat/templates/view/{side}', [SertifikatController::class, 'viewTemplate']);
        });

        // --- Intern Profile (Mahasiswa) Management ---
        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::get('/mahasiswa', [InternProfileController::class, 'index']);
            // POST: create mahasiswa profile (uses storeProfile in controller)
            Route::post('/mahasiswa', [InternProfileController::class, 'storeAdminProfile']);
            // Admin minimal profile creation
            Route::post('/mahasiswa/admin', [InternProfileController::class, 'storeAdminProfile']);
            Route::get('/mahasiswa/{id}', [InternProfileController::class, 'show'])->whereNumber('id');
            Route::put('/mahasiswa/{id}', [InternProfileController::class, 'update'])->whereNumber('id');
            Route::delete('/mahasiswa/{id}', [InternProfileController::class, 'destroy'])->whereNumber('id');
            Route::get('/mahasiswa/{id}/bank-proof', [InternProfileController::class, 'getBankProof'])->whereNumber('id'); // Get bank proof via endpoint
            Route::get('/mahasiswa/no-user', [UserController::class, 'getInternNoUser']);
        });

        // --- Site/Office Location Management ---
        Route::middleware('permission:view_office_locations')->group(function () {
            Route::get('/sites', [SiteController::class, 'index']);
            Route::post('/sites', [SiteController::class, 'store']);
            Route::get('/sites/{id}', [SiteController::class, 'show'])->whereNumber('id');
            Route::put('/sites/{id}', [SiteController::class, 'update'])->whereNumber('id');
            Route::put('/sites/{id}/geofence', [SiteController::class, 'updateGeofence'])->whereNumber('id');
            Route::delete('/sites/{id}', [SiteController::class, 'destroy'])->whereNumber('id');
        });

        // --- Logbook Management ---
        Route::middleware('permission:view_logbook')->group(function () {
            Route::get('/logbook', [LogbookController::class, 'listAll']);
            Route::get('/logbook/user/{user_id}', [LogbookController::class, 'listByIntern'])->whereNumber('user_id');
        });

        // --- Tag Master Data (Admin) ---
        Route::prefix('tags')->middleware('permission:view_logbook_tags')->group(function () {
            Route::get('/', [TagController::class, 'index']);
            Route::post('/', [TagController::class, 'store']);
            Route::put('/{id}', [TagController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [TagController::class, 'destroy'])->whereNumber('id');
        });

        Route::middleware('permission:view_intern_profiles')->group(function () {
            Route::post('/intern-profiles', [InternProfileController::class, 'storeProfile']); // Create mahasiswa profile (public, tanpa user)
            Route::get('/intern-profiles', [InternProfileController::class, 'index']);
            Route::get('/intern-profiles/{id}', [InternProfileController::class, 'show'])->whereNumber('id');
            Route::put('/intern-profiles/{id}', [InternProfileController::class, 'update'])->whereNumber('id');
            Route::post('/intern-profiles/{id}', [InternProfileController::class, 'update'])->whereNumber('id'); // Fallback for multipart/form-data
            Route::post('/intern-profiles/{id}/create-user', [InternProfileController::class, 'createUserForMahasiswa'])->whereNumber('id'); // Create user from mahasiswa
            Route::get('/intern-profiles/{id}/photo', [InternProfileController::class, 'getPhoto'])->whereNumber('id');
            Route::get('/intern-profiles/{id}/bank-proof', [InternProfileController::class, 'getBankProof'])->whereNumber('id'); // Get bank proof via endpoint
        });


        // --- Work Schedules Management ---
        Route::middleware('permission:view_working_schedule')->group(function () {
            Route::get('/work-schedules', [WorkScheduleController::class, 'index']);
            Route::post('/work-schedules', [WorkScheduleController::class, 'store']);
            Route::get('/work-schedules/template', [WorkScheduleController::class, 'downloadTemplate']);
            Route::post('/work-schedules/preview', [WorkScheduleController::class, 'preview']);
            Route::post('/work-schedules/import', [WorkScheduleController::class, 'import']);
            Route::get('/work-schedules/{id}', [WorkScheduleController::class, 'show'])->whereNumber('id');
            Route::put('/work-schedules/{id}', [WorkScheduleController::class, 'update'])->whereNumber('id');
            Route::delete('/work-schedules/{id}', [WorkScheduleController::class, 'destroy'])->whereNumber('id');
        });
    });

});