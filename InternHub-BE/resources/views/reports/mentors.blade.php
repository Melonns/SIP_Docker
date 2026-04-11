<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Mentor List Report</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .footer { margin-top: 20px; text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mentor List Report</h1>
        @if($division)
            <p>Division: {{ $division }}</p>
        @endif
        <p>Generated on: {{ date('Y-m-d H:i:s') }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th width="5%">No</th>
                <th width="30%">Mentor Name</th>
                <th width="25%">Division</th>
                <th width="40%">Assigned Interns</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data as $index => $row)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $row->name }}</td>
                <td>{{ $row->division ?: '-' }}</td>
                <td>
                    @if(count($row->assigned_interns) > 0)
                        <ul style="padding-left: 20px; margin: 0;">
                            @foreach($row->assigned_interns as $intern)
                                <li>{{ $intern->nama }} ({{ $intern->universitas }})</li>
                            @endforeach
                        </ul>
                    @else
                        -
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        <p>Total Mentors: {{ count($data) }}</p>
    </div>
</body>
</html>
