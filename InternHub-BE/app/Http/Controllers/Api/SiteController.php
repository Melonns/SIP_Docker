<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TblSite;
use App\Models\Division;
use Illuminate\Http\Request;
use App\Models\TblMahasiswa;

class SiteController extends Controller
{
    /**
     * List semua site/lokasi kantor
     */
    public function index(Request $request)
    {
        $query = TblSite::query();

        // Search by nama
        if ($request->has('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('nama_site', 'like', "%{$search}%")
                  ->orWhere('alamat', 'like', "%{$search}%");
            });
        }

        // Filter by status aktif: ?status=active|inactive
        if ($request->has('status')) {
            if ($request->status === 'active') {
                $query->where('is_active', true);
            } elseif ($request->status === 'inactive') {
                $query->where('is_active', false);
            }
        }

        $sites = $query->get();

        return response()->json([
            'success' => true,
            'count' => $sites->count(),
            'data' => $sites
        ]);
    }

    /**
     * Detail site
     */
    public function show($id)
    {
        $site = TblSite::with('settingAbsensi')->find($id);

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $site
        ]);
    }

    /**
     * Create site baru (Admin)
     */
    public function store(Request $request)
    {
        $request->validate([
            'nama_site' => 'required|string|max:255',
            'alamat' => 'required|string|max:500',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius_meter' => 'required|numeric|min:10', // Min 10m, Max 1km
            'is_active' => 'sometimes|boolean',
        ]);

        $site = TblSite::create($request->only([
            'nama_site', 'alamat', 'latitude', 'longitude', 'radius_meter', 'is_active'
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Site berhasil ditambahkan',
            'data' => $site
        ], 201);
    }

    /**
     * Update site (Admin)
     * Admin bisa mengubah Latitude, Longitude, dan Radius melalui UI
     */
    public function update(Request $request, $id)
    {
        $site = TblSite::find($id);

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'nama_site' => 'sometimes|required|string|max:255',
            'alamat' => 'sometimes|required|string|max:500',
            'latitude' => 'sometimes|required|numeric|between:-90,90',
            'longitude' => 'sometimes|required|numeric|between:-180,180',
            'radius_meter' => 'sometimes|required|numeric|min:10|max:1000',
            'is_active' => 'sometimes|boolean',
        ]);

        $site->update($request->only([
            'nama_site', 'alamat', 'latitude', 'longitude', 'radius_meter', 'is_active'
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Site berhasil diperbarui',
            'data' => $site
        ]);
    }

    /**
     * Update geofence config saja (Admin)
     * Endpoint khusus untuk update lokasi dan radius
     */
    public function updateGeofence(Request $request, $id)
    {
        $site = TblSite::find($id);

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius_meter' => 'required|numeric|min:10|max:1000',
        ]);

        $site->update([
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'radius_meter' => $request->radius_meter,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Geofence config berhasil diperbarui',
            'data' => [
                'id_site' => $site->id_site,
                'nama_site' => $site->nama_site,
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'radius_meter' => $site->radius_meter,
            ]
        ]);
    }

    /**
     * Delete site (Admin)
     */
    public function destroy($id)
    {
        $site = TblSite::find($id);

        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site tidak ditemukan'
            ], 404);
        }

        // Cek apakah ada user yang terkait dengan site ini
        if ($site->mahasiswa()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Site tidak dapat dihapus karena masih ada mahasiswa yang terkait'
            ], 400);
        }

        $site->delete();

        return response()->json([
            'success' => true,
            'message' => 'Site berhasil dihapus'
        ]);
    }

    /**
     * Filters endpoint: return available universities, divisions, and sites
     * - Accessible by admin and mentor only
     * - Mentor sees only options related to their interns
     */
    public function filters(Request $request)
    {
        $user = $request->user();
        if (!$user || (! $user->isAdmin() && ! $user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        // Initialize collections
        $universities = collect([]);
        $divisions = collect([]);
        $sites = collect([]);

        if ($user->isAdmin()) {
            $universities = TblMahasiswa::whereNotNull('universitas')
                ->where('universitas', '<>', '')
                ->selectRaw('TRIM(universitas) as universitas')
                ->distinct()
                ->orderBy('universitas')
                ->pluck('universitas');

            $divisions = Division::orderBy('name')->pluck('name');

            $sites = TblSite::select(['id_site', 'nama_site'])->orderBy('nama_site')->get();
        } else {
            $direct = $user->interns()->pluck('users.user_id')->toArray();
            $viaStudents = \DB::table('intern_mentors as im')
                ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
                ->where('im.is_active', 1)
                ->where(function($q) use ($user) {
                    $q->where('im.mentor_user_id', $user->user_id);
                    if ($user->karyawan?->id_karyawan) {
                        $q->orWhere('im.mentor_id', $user->karyawan->id_karyawan);
                    }
                })
                ->pluck('s.user_id')
                ->filter()
                ->toArray();
            $internIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            if (!empty($internIds)) {
                $universities = TblMahasiswa::whereIn('user_id', $internIds)
                    ->whereNotNull('universitas')
                    ->where('universitas', '<>', '')
                    ->selectRaw('TRIM(universitas) as universitas')
                    ->distinct()
                    ->orderBy('universitas')
                    ->pluck('universitas');

                $divisions = Division::orderBy('name')->pluck('name');

                $siteIds = TblMahasiswa::whereIn('user_id', $internIds)->pluck('id_site')->filter()->unique()->toArray();
                if (!empty($siteIds)) {
                    $sites = TblSite::whereIn('id_site', $siteIds)->select(['id_site', 'nama_site'])->orderBy('nama_site')->get();
                }
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'universities' => $universities,
                'divisions' => $divisions,
                'sites' => $sites,
            ]
        ]);
    }
}
