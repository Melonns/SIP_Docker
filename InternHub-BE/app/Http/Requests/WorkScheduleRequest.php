<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WorkScheduleRequest extends FormRequest
{
    public function authorize()
    {
        // Authorization handled via middleware/policies
        return true;
    }

    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            // Either a global start/end OR per-day times via day_times
            'start_time' => 'required_without:day_times|date_format:H:i:s',
            'end_time' => 'required_without:day_times|date_format:H:i:s|after:start_time',
            'day_times' => 'nullable|array',
            'day_times.*' => 'array',
            'day_times.*.start' => 'required_with:day_times|date_format:H:i:s',
            'day_times.*.end' => 'required_with:day_times|date_format:H:i:s',
            'days' => 'nullable|array',
            'days.*' => 'in:mon,tue,wed,thu,fri,sat,sun',
            'is_active' => 'boolean',
            'tolerance' => 'nullable|integer|min:0',
            'toleransi' => 'nullable|integer|min:0'
        ];
    }
}
