<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Attendance Report</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 16px; margin: 5px 0; }
        .header p { font-size: 10px; margin: 2px 0; }
        .period { margin-bottom: 20px; font-size: 10px; }
        .period p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 9px; }
        th { background-color: #f2f2f2; }
        tr.highlight { background-color: #FFFF00; }

        /* Status rendered as plain text (no badge styles) */
    </style>
</head>
<body>
    <div class="header">
        <h2>ATTENDANCE REPORT</h2>
        @if($mentor)
            <p>Mentor: {{ $mentor }}</p>
        @endif
    </div>
    <div class="period">
        <p>Generated Start Date: {{ $period }}</p>
        @php
            $totalPresent = 0;
            if (isset($data) && is_array($data)) {
                foreach ($data as $r) {
                    // Count On Time, Late and Early as present
                    if (in_array($r->status, ['On Time', 'Late', 'Early'])) {
                        $totalPresent++;
                    }
                }
            }
        @endphp
        <p><strong>Total Present (On Time + Late + Early):</strong> {{ $totalPresent }}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Major</th>
                <th>Institution</th>
                <th>Status</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Notes/Reason</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data as $row)
            <tr @if(in_array($row->status, ['Absent', 'Sick', 'On Leave'])) class="highlight" @endif>
                <td>{{ $row->date }}</td>
                <td>{{ $row->name }}</td>
                <td>{{ $row->jurusan ?: '-' }}</td>
                <td>{{ $row->univ ?: '-' }}</td>
                <td>{{ $row->status }}</td>
                <td>{{ $row->clock_in ?: '-' }}</td>
                <td>{{ $row->clock_out ?: '-' }}</td>
                <td>{{ $row->notes ?: '-' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>