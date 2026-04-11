<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Assigned Interns Report</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 16px; margin: 5px 0; }
        .header p { font-size: 10px; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 9px; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h2>ASSIGNED INTERNS REPORT</h2>
        @if($mentor)
            <p>Mentor: {{ $mentor }}</p>
        @endif
    </div>
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Institution</th>
                <th>Major</th>
                <th>Division</th>
                <th>Site</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data as $row)
            <tr>
                <td>{{ $row->name }}</td>
                <td>{{ $row->university }}</td>
                <td>{{ $row->major }}</td>
                <td>{{ $row->division ?: '-' }}</td>
                <td>{{ $row->site }}</td>
                <td>{{ $row->start_date }}</td>
                <td>{{ $row->end_date }}</td>
                <td>{{ $row->status }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>