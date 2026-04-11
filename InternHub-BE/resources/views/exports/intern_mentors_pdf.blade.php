<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>List Intern-Mentor</title>
    <style>
        body { font-family: sans-serif; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #000; padding: 6px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { text-align: center; margin-bottom: 10px; }
        .header h2 { margin: 0; }
        .header p { margin: 4px 0; }
        .meta { margin-top: 8px; margin-bottom: 8px; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: right; font-size: 9pt; color: #555; }
    </style>
</head>
<body>
    <div class="header">
        <h2>List Intern-Mentor</h2>
        <p>Generated at: {{ \Carbon\Carbon::now()->translatedFormat('d F Y H:i') }}</p>
    </div>

    @php
        // Detect if all rows belong to a single mentor
        $mentorIds = $data->pluck('mentor')->map(fn($m) => $m->user_id ?? null)->unique()->filter()->values();
        $singleMentor = $mentorIds->count() === 1 ? $data->first()->mentor : null;
    @endphp

    @if($singleMentor)
        <div class="meta"><strong>Mentor:</strong> {{ $singleMentor->nama }} @if(!empty($singleMentor->identifier)) ({{ $singleMentor->identifier }}) @endif</div>
    @endif

    <table>
        <thead>
            <tr>
                <th style="width:5%">No</th>
                <th style="width:30%">Name</th>
                <th style="width:20%">Institution</th>
                <th style="width:15%">Division</th>
                <th style="width:15%">Job Position</th>
                <th style="width:15%">Internship Period</th>
            </tr>
        </thead>
        <tbody>
            @forelse($data as $index => $item)
                @php
                    $intern = $item->intern ?? null;
                    $mhs = $intern->mahasiswa ?? null;
                    $period = '-';
                    if(!empty($mhs->mulai_magang) || !empty($mhs->akhir_magang)){
                        try {
                            $start = !empty($mhs->mulai_magang) ? \Carbon\Carbon::parse($mhs->mulai_magang)->format('d M Y') : null;
                            $end = !empty($mhs->akhir_magang) ? \Carbon\Carbon::parse($mhs->akhir_magang)->format('d M Y') : null;
                            $period = trim(($start ? $start : '') . ($start && $end ? ' - ' : '') . ($end ? $end : '')) ?: '-';
                        } catch (Exception $e) {
                            $period = '-';
                        }
                    }
                @endphp
                <tr>
                    <td style="text-align:center">{{ $index + 1 }}</td>
                    <td>{{ $intern->nama ?? $intern->username ?? '-' }}</td>
                    <td>{{ $mhs->universitas ?? '-' }}</td>
                    <td>{{ $mhs->division ?? '-' }}</td>
                    <td>{{ $mhs->job_position ?? '-' }}</td>
                    <td>{{ $period }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align:center">No data available</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        <p>SIP System</p>
    </div>
</body>
</html>