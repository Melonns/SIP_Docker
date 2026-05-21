<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

class SecureFileController extends Controller
{
    public function show(Request $request)
    {
        $path = $request->query('path');

        if (!$path) {
            return response()->json(['message' => 'Path is required'], 400);
        }

        // Validate that path is within the allowed directory to prevent directory traversal
        // It should start with 'encrypted/'
        if (!str_starts_with($path, 'encrypted/')) {
            return response()->json(['message' => 'Invalid file path'], 403);
        }

        if (!Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        try {
            $encryptedContents = Storage::disk('local')->get($path);
            $decryptedContents = Crypt::decryptString($encryptedContents);
            
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: 'application/octet-stream';

            return response($decryptedContents, 200)
                ->header('Content-Type', $mime)
                ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                ->header('Pragma', 'no-cache');
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to decrypt file'], 500);
        }
    }
}
