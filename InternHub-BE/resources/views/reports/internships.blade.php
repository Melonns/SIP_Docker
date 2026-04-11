<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>INTERNSHIP LIST REPORT</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
        }

        th {
            background-color: #f2f2f2;
        }

        .footer {
            margin-top: 20px;
            text-align: right;
        }

        .status-active {
            color: green;
            font-weight: bold;
        }

        .status-completed {
            color: blue;
            font-weight: bold;
        }
    </style>
</head>

<body>
    <div class="header">
        <h2>INTERNSHIP LIST REPORT</h2>
        @if ($mentor_name)
            <p>Mentor: {{ $mentor_name }}</p>
        @endif
        <p>Generated on: {{ date('Y-m-d H:i:s') }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th width="5%">No</th>
                <th width="20%">Name</th>
                <th width="20%">Institution</th>

                <th width="15%">Division</th>
                <th width="15%">Job Position</th>
                <th width="15%">Internship Period</th>

                <th width="10%">Status</th>
                <th width="15%">Mentor</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($data as $index => $row)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $row->nama }}</td>
                    <td>{{ $row->universitas }}</td>

                    <td>{{ $row->division ?? '-' }}</td>

                    <td>{{ $row->job_position ?? '-' }}</td>
                    <td>
                        @php
                            $startDate = is_string($row->mulai_magang)
                                ? $row->mulai_magang
                                : $row->mulai_magang->format('Y-m-d');
                            $endDate = is_string($row->akhir_magang)
                                ? $row->akhir_magang
                                : $row->akhir_magang->format('Y-m-d');
                        @endphp
                        {{ $startDate }} - {{ $endDate }}
                    </td>
                    <td class="status-{{ strtolower($row->status) }}">{{ ucfirst($row->status) }}</td>

                    <td>
                        @if ($row->mentors->isNotEmpty())
                            {{ $row->mentors->pluck('nama')->implode(', ') }}
                        @else
                            -
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        <p>Total Interns: {{ count($data) }}</p>
    </div>
</body>

</html>
