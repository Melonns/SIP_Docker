<!DOCTYPE html>
<html>

<head>
    <title>Laporan Uang Saku Magang</title>
    <style>
        body {
            font-family: sans-serif;
            font-size: 10pt;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h2 {
            margin: 0;
        }

        .meta {
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        th,
        td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: top;
            font-size: 9pt;
        }

        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .page-break {
            page-break-after: always;
        }
    </style>
</head>

<body>
    <div class="header">
        <h2>LAPORAN UANG SAKU MAGANG</h2>
        <p style="margin: 5px 0;">Start Date: {{ $period }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 4%">No</th>
                <th style="width: 12%">Name</th>
                <th style="width: 12%">Institution</th>
                <th style="width: 10%">Division</th>
                <th style="width: 12%">Job Position</th>
                <th style="width: 12%">Internship Period</th>
                <th style="width: 8%; text-align: center;">Total Days</th>
                <th style="width: 10%; text-align: center;">Daily Allowance</th>
                <th style="width: 12%; text-align: center;">Total Allowance</th>
                <th style="width: 10%">Bank Account No</th>
                <th style="width: 10%">Bank Name</th>
                <th style="width: 12%">Bank Account Holder</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data as $row)
                <tr>
                    <td style="text-align: center;">{{ $row['no'] }}</td>
                    <td>{{ $row['name'] }}</td>
                    <td>{{ $row['institution'] }}</td>
                    <td>{{ $row['division'] }}</td>
                    <td>{{ $row['job_position'] }}</td>
                    <td>{{ $row['internship_period'] }}</td>
                    <td style="text-align: center;">{{ $row['total_days'] }}</td>
                    <td style="text-align: right;">Rp {{ $row['daily_allowance'] }}</td>
                    <td style="text-align: right;"><strong>Rp {{ $row['total_allowance'] }}</strong></td>
                    <td>{{ $row['bank_account_no'] }}</td>
                    <td>{{ $row['bank_name'] }}</td>
                    <td>{{ $row['bank_account_holder'] }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="12" style="text-align: center;">No data available</td>
                </tr>
            @endforelse
        </tbody>
    </table>

