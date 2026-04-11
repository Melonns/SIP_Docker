<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\Request;

class TagController extends Controller
{
    /**
     * List semua tag (semua authenticated user)
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 10);
        $query = Tag::query();

        if ($request->filled('q')) {
            $query->where('nama', 'like', '%' . $request->q . '%');
        }

        $tags = $query->orderBy('nama')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $tags,
        ]);
    }

    /**
     * Buat tag baru (Admin only)
     */
    public function store(Request $request)
    {
        $request->validate([
            'nama'   => 'required|string|max:100|unique:tags,nama',
            'warna'  => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ], [
            'nama.required' => 'Nama tag harus diisi',
            'nama.unique'   => 'Nama tag sudah ada',
            'warna.regex'   => 'Warna harus berupa hex color yang valid (contoh: #3B82F6)',
        ]);

        try {
            $tag = Tag::create([
                'nama'  => $request->nama,
                'warna' => $request->warna ?? '#6B7280',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Tag berhasil dibuat',
                'data'    => $tag,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat tag: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update tag (Admin only)
     */
    public function update(Request $request, $id)
    {
        $tag = Tag::find($id);

        if (!$tag) {
            return response()->json([
                'success' => false,
                'message' => 'Tag tidak ditemukan',
            ], 404);
        }

        $request->validate([
            'nama'  => 'required|string|max:100|unique:tags,nama,' . $id,
            'warna' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ], [
            'nama.required' => 'Nama tag harus diisi',
            'nama.unique'   => 'Nama tag sudah ada',
            'warna.regex'   => 'Warna harus berupa hex color yang valid (contoh: #3B82F6)',
        ]);

        try {
            $tag->update([
                'nama'  => $request->nama,
                'warna' => $request->warna ?? $tag->warna,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Tag berhasil diperbarui',
                'data'    => $tag,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui tag: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Hapus tag (Admin only)
     * Logbook yang menggunakan tag ini akan di-set null (SET NULL on delete)
     */
    public function destroy($id)
    {
        $tag = Tag::find($id);

        if (!$tag) {
            return response()->json([
                'success' => false,
                'message' => 'Tag tidak ditemukan',
            ], 404);
        }

        try {
            $logbookCount = $tag->logbooks()->count();
            $tag->delete();

            return response()->json([
                'success'        => true,
                'message'        => 'Tag berhasil dihapus',
                'affected_logbooks' => $logbookCount,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus tag: ' . $e->getMessage(),
            ], 500);
        }
    }
}
