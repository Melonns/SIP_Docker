<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvaluationComponentMaster;
use Illuminate\Http\Request;

class EvaluationComponentController extends Controller
{
    /**
     * Get list of all evaluation components (master data)
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        $query = EvaluationComponentMaster::query();

        // Search by nama_komponen
        if ($request->has('q')) {
            $search = $request->q;
            $query->where('nama_komponen', 'like', "%{$search}%");
        }

        // Order by nama_komponen
        $query->orderBy('nama_komponen', 'asc');

        $components = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $components
        ]);
    }

    /**
     * Get single evaluation component by ID
     */
    public function show($id)
    {
        $component = EvaluationComponentMaster::find($id);

        if (!$component) {
            return response()->json([
                'success' => false,
                'message' => 'Komponen penilaian tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $component
        ]);
    }

    /**
     * Create new evaluation component
     */
    public function store(Request $request)
    {
        $request->validate([
            'nama_komponen' => 'required|string|max:255|unique:evaluation_components,nama_komponen',
        ], [
            'nama_komponen.required' => 'Nama komponen harus diisi',
            'nama_komponen.unique' => 'Nama komponen sudah ada',
        ]);

        try {
            $component = EvaluationComponentMaster::create([
                'nama_komponen' => $request->nama_komponen,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Komponen penilaian berhasil dibuat',
                'data' => $component
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat komponen penilaian: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update evaluation component
     */
    public function update(Request $request, $id)
    {
        $component = EvaluationComponentMaster::find($id);

        if (!$component) {
            return response()->json([
                'success' => false,
                'message' => 'Komponen penilaian tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'nama_komponen' => 'required|string|max:255|unique:evaluation_components,nama_komponen,' . $id . ',id',
        ], [
            'nama_komponen.required' => 'Nama komponen harus diisi',
            'nama_komponen.unique' => 'Nama komponen sudah ada',
        ]);

        try {
            $component->update([
                'nama_komponen' => $request->nama_komponen,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Komponen penilaian berhasil diperbarui',
                'data' => $component
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui komponen penilaian: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete evaluation component
     */
    public function destroy($id)
    {
        $component = EvaluationComponentMaster::find($id);

        if (!$component) {
            return response()->json([
                'success' => false,
                'message' => 'Komponen penilaian tidak ditemukan'
            ], 404);
        }

        try {
            $component->delete();

            return response()->json([
                'success' => true,
                'message' => 'Komponen penilaian berhasil dihapus'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus komponen penilaian: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk delete evaluation components
     */
    public function bulkDelete(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:evaluation_components,id',
        ]);

        try {
            EvaluationComponentMaster::whereIn('id', $request->ids)->delete();

            return response()->json([
                'success' => true,
                'message' => 'Komponen penilaian berhasil dihapus',
                'deleted_count' => count($request->ids)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus komponen penilaian: ' . $e->getMessage()
            ], 500);
        }
    }
}
