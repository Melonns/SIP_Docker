<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\WorkSchedule;

class WorkScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $schedules = [
            [
                'name' => 'Shift Pagi',
                'start_time' => '08:00:00',
                'end_time' => '16:00:00',
                'days' => ['mon','tue','wed','thu','fri'],
                'day_times' => [
                    'mon' => ['start' => '08:00:00', 'end' => '16:00:00'],
                    'tue' => ['start' => '08:00:00', 'end' => '16:00:00'],
                    'wed' => ['start' => '08:00:00', 'end' => '16:00:00'],
                    'thu' => ['start' => '08:00:00', 'end' => '16:00:00'],
                    'fri' => ['start' => '08:00:00', 'end' => '16:00:00'],
                ],
                'is_active' => true,
                'tolerance' => 10,
            ],
            [
                'name' => 'Shift Malam',
                'start_time' => '16:00:00',
                'end_time' => '00:00:00',
                'days' => ['mon','tue','wed','thu','fri'],
                'day_times' => [
                    'mon' => ['start' => '16:00:00', 'end' => '00:00:00'],
                    'tue' => ['start' => '16:00:00', 'end' => '00:00:00'],
                    'wed' => ['start' => '16:00:00', 'end' => '00:00:00'],
                    'thu' => ['start' => '16:00:00', 'end' => '00:00:00'],
                    'fri' => ['start' => '16:00:00', 'end' => '00:00:00'],
                ],
                'is_active' => true,
                'tolerance' => 5,
            ],
            [
                'name' => 'Shift Sabtu',
                'start_time' => '08:00:00',
                'end_time' => '12:00:00',
                'days' => ['sat'],
                'day_times' => [
                    'sat' => ['start' => '08:00:00', 'end' => '12:00:00'],
                ],
                'is_active' => true,
                'tolerance' => 0,
            ],
        ];

        foreach ($schedules as $s) {
            // updateOrCreate so seeder is idempotent
            WorkSchedule::updateOrCreate(
                ['name' => $s['name']],
                [
                    'start_time' => $s['start_time'],
                    'end_time' => $s['end_time'],
                    'days' => $s['days'],
                    'day_times' => $s['day_times'],
                    'is_active' => $s['is_active'],
                    'tolerance' => $s['tolerance'],
                ]
            );
        }

        // DEPRECATED: work_schedule_id moved to students
        // Don't assign work schedule to users table anymore
    }
}
