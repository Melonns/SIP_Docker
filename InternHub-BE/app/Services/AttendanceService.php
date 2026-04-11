<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use App\Models\WorkSchedule;

class AttendanceService
{
    /**
     * Calculate lateness in minutes based on user's work schedule or site default.
     * 
     * @param User $user
     * @param string|Carbon $clockInTime Format 'H:i:s' or Carbon instance
     * @param string|Carbon|null $date Date for day-specific schedules
     * @return int Lateness in minutes
     */
    public static function calculateLateness(User $user, $clockInTime, $date = null)
    {
        $clockIn = $clockInTime instanceof Carbon ? $clockInTime : Carbon::parse($clockInTime);
        $date = $date ? Carbon::parse($date) : Carbon::today();
        
        $schedule = self::getExpectedStartTime($user, $date);
        $startTime = Carbon::parse($date->toDateString() . ' ' . $schedule['start_time']);
        $actualTime = Carbon::parse($date->toDateString() . ' ' . $clockIn->toTimeString());
        $tolerance = $schedule['tolerance'];

        // If clock in is before or exactly at start time, no lateness
        if ($actualTime->lessThanOrEqualTo($startTime)) {
            return 0;
        }

        $diffMinutes = $startTime->diffInMinutes($actualTime);

        // If lateness exceeds tolerance, return full duration (or just the excess? Standard is full duration for "treshold" tolerance)
        // Here we use the common logic: if you exceed tolerance, you are late by the actual difference.
        if ($diffMinutes > $tolerance) {
            return $diffMinutes;
        }

        return 0;
    }

    /**
     * Determine the expected start time and tolerance for a user on a given date.
     */
    public static function getExpectedStartTime(User $user, $date)
    {
        $date = Carbon::parse($date);
        $dayKey = strtolower($date->format('D')); // mon, tue, wed...
        
        // Priority 1: Work Schedule (Relationship)
        $workSchedule = $user->workSchedule;
        
        if ($workSchedule) {
            $dayTimes = $workSchedule->day_times;
            $tolerance = $workSchedule->tolerance ?? 0;

            // Check day-specific time
            if ($dayTimes && isset($dayTimes[$dayKey]) && !empty($dayTimes[$dayKey]['start'])) {
                return [
                    'start_time' => $dayTimes[$dayKey]['start'],
                    'tolerance' => $tolerance
                ];
            }

            // Global schedule time
            if ($workSchedule->start_time) {
                return [
                    'start_time' => $workSchedule->start_time,
                    'tolerance' => $tolerance
                ];
            }
        }

        // Priority 2: Site Setting
        if ($user->site && $user->site->jam_masuk) {
            return [
                'start_time' => $user->site->jam_masuk,
                'tolerance' => 0 // Sites currently don't have tolerance column
            ];
        }

        // Priority 3: Global Default
        return [
            'start_time' => '08:00:00',
            'tolerance' => 0
        ];
    }
}
