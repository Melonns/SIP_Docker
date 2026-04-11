<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Division;
use App\Models\TblMahasiswa;

class DivisionController extends Controller
{
    /**
     * Get list of available divisions
     * Protected by role:admin,mentor middleware
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Admin gets all divisions
        if ($user->isAdmin()) {
            $divisions = Division::orderBy('name')->get();
            return response()->json([
                'success' => true,
                'data' => $divisions
            ]);
        }
        
        // Mentor gets divisions related to their site or their interns
        if ($user->isMentor()) {
            // Get mentor's site ID if available
            $siteId = $user->karyawan?->id_site;
            
            $query = Division::query();
            
            // If mentor belongs to a site, prioritize divisions from that site
            if ($siteId) {
                $query->where(function($q) use ($siteId) {
                    $q->where('site_id', $siteId)
                      ->orWhereNull('site_id'); // Include global divisions
                });
            }
            
            $divisions = $query->orderBy('name')->get();
            
            return response()->json([
                'success' => true,
                'data' => $divisions
            ]);
        }
        
        return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
    }

    /**
     * Sync/Import divisions from existing student data
     * (Admin only utility)
     */
    public function syncFromStudents(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $studentDivisions = TblMahasiswa::whereNotNull('division')
            ->where('division', '<>', '')
            ->distinct()
            ->pluck('division');

        $count = 0;
        foreach ($studentDivisions as $divName) {
            $divName = trim($divName);
            if (empty($divName)) continue;

            $division = Division::firstOrCreate(
                ['slug' => \Illuminate\Support\Str::slug($divName)],
                ['name' => $divName]
            );
            if ($division->wasRecentlyCreated) {
                $count++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Synced $count new divisions from student profiles",
            'total_found' => $studentDivisions->count()
        ]);
    }
}
