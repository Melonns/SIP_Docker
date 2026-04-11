<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkSchedule extends Model
{
    protected $table = 'work_schedules';
    protected $primaryKey = 'id';
    protected $fillable = ['name', 'start_time', 'end_time', 'days', 'day_times', 'is_active', 'tolerance'];

    protected $casts = [
        'is_active' => 'boolean',
        'tolerance' => 'integer',
    ];

    public function getDaysAttribute($value)
    {
        return $value ? json_decode($value, true) : [];
    }

    public function setDaysAttribute($value)
    {
        $this->attributes['days'] = $value ? json_encode($value) : null;
    }

    public function getDayTimesAttribute($value)
    {
        return $value ? json_decode($value, true) : null; // associative: day => ['start' => 'H:i:s', 'end' => 'H:i:s']
    }

    public function setDayTimesAttribute($value)
    {
        $this->attributes['day_times'] = $value ? json_encode($value) : null;
    }

    /**
     * Get the globally active work schedule.
     * All interns share the same active schedule.
     */
    public static function getActive(): ?self
    {
        return static::where('is_active', true)->first();
    }
}
