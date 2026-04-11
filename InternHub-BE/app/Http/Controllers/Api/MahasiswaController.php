<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TblMahasiswa;
use Illuminate\Http\Request;

class MahasiswaController extends Controller
{
    public function index(Request $request)
    {
        // Eager load related user so we can include division in the response
        $query = TblMahasiswa::with('user');

        // Search by keyword (nama, universitas, jurusan, nim)
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhere('universitas', 'like', "%{$search}%")
                  ->orWhere('jurusan', 'like', "%{$search}%")
                  ->orWhere('nim', 'like', "%{$search}%");
            });
        }

        // Filter by universitas
        if ($request->has('universitas')) {
            $query->where('universitas', 'like', "%{$request->universitas}%");
        }

        // Filter by jurusan
        if ($request->has('jurusan')) {
            $query->where('jurusan', 'like', "%{$request->jurusan}%");
        }

        // Filter by site
        if ($request->has('id_site')) {
            $query->where('id_site', $request->id_site);
        }

        $mahasiswa = $query->get();

        return response()->json([
            'success' => true,
            'count'   => $mahasiswa->count(),
            'data'    => $mahasiswa
        ]);
    }

    public function show($id)
    {
        // include related user (for division)
        $mahasiswa = TblMahasiswa::with('user')->find($id);

        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $mahasiswa
        ]);
    }

    public function show_absensi($id)
    {
        $mahasiswa = TblMahasiswa::with('absensi')->find($id);

        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $mahasiswa->absensi
        ]);
    }

    public function show_kegiatan($id)
    {
        $mahasiswa = TblMahasiswa::with('kegiatan')->find($id);

        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => $mahasiswa->kegiatan
        ]);
    }
}
