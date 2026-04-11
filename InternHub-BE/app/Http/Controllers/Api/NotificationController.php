<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $perPage = $request->input('limit', 10);
        $role = $request->input('role'); // Optional role filter

        $query = $user->notifications();

        if ($role) {
            $query->where('target_role', $role);
        }

        $notifications = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $notifications
        ]);
    }

    /**
     * Get only unread notifications count
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user();
        $role = $request->input('role');

        $query = $user->unreadNotifications();

        if ($role) {
            $query->where('target_role', $role);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $query->count()
            ]
        ]);
    }

    /**
     * Mark a specific notification as read
     */
    public function markAsRead(Request $request, $id)
    {
        $user = $request->user();
        $notification = $user->notifications()->where('id', $id)->first();
        
        if ($notification) {
            $notification->markAsRead();
            return response()->json([
                'success' => true,
                'message' => 'Notifikasi ditandai sudah dibaca.'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Notifikasi tidak ditemukan.'
        ], 404);
    }

    /**
     * Mark all unread notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        $user = $request->user();
        $role = $request->input('role');

        $query = $user->unreadNotifications();

        if ($role) {
            $query->where('target_role', $role);
        }

        $query->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Semua notifikasi ditandai sudah dibaca.'
        ]);
    }

    /**
     * Delete a specific notification
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $notification = $user->notifications()->where('id', $id)->first();

        if ($notification) {
            $notification->delete();
            return response()->json([
                'success' => true,
                'message' => 'Notifikasi berhasil dihapus.'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Notifikasi tidak ditemukan.'
        ], 404);
    }

    /**
     * Delete all notifications (optionally filtered by role)
     */
    public function destroyAll(Request $request)
    {
        $user = $request->user();
        $role = $request->input('role');

        $query = $user->notifications();

        if ($role) {
            $query->where('target_role', $role);
        }

        $query->delete();

        return response()->json([
            'success' => true,
            'message' => 'Semua notifikasi berhasil dihapus.'
        ]);
    }
}
