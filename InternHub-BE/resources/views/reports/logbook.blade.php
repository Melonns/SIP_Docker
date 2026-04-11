<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Logbook Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .header h1 {
            font-size: 16px;
            margin: 5px 0;
        }
        
        .header p {
            font-size: 10px;
            margin: 2px 0;
        }

        .period {
            margin-bottom: 20px;
            font-size: 10px;
        }
        
        .period p {
            margin: 2px 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 5px;
            text-align: left;
            font-size: 9px;
            word-wrap: break-word;
        }

        th {
            background-color: #f2f2f2;
        }
        
        /* Prevent names from wrapping */
        td:nth-child(2) {
            white-space: nowrap;
        }
        
        /* Activity Description column - column 7 */
        td:nth-child(7) {
            max-width: 180px;
            word-break: break-word;
            white-space: normal;
        }
        
        /* Evidence column - now column 10 */
        td:nth-child(10) {
            min-height: 180px;
            vertical-align: top;
        }
    </style>
</head>

<body>
    <div class="header">
        <h2>LOGBOOK REPORT</h2>
        @if($mentor)
            <p>Mentor: {{ $mentor }}</p>
        @endif
    </div>
    <div class="period">
        @php
            $rows = collect($data ?? []);
            $totalLogbook = $rows->count();
            $logbookByIntern = $rows
                ->groupBy(function ($item) {
                    return trim((string) ($item->name ?? 'Tanpa Nama'));
                })
                ->map(function ($items) {
                    return $items->count();
                })
                ->sortKeys();
        @endphp
        <p>Generated Start Date: {{ $period }}</p>
        <p><strong>Total Logbook (Verified):</strong> {{ $totalLogbook }}</p>
        @if($logbookByIntern->isNotEmpty())
            <p><strong>Rincian per Intern:</strong>
                @foreach($logbookByIntern as $internName => $count)
                    {{ $internName }} = {{ $count }} logbook{{ $loop->last ? '' : '; ' }}
                @endforeach
            </p>
        @endif
    </div>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Institution</th>
                <th>Major</th>
                <th>Job Position</th>
                <th>Mentor</th>
                <th>Activity Description</th>
                <th>Status</th>
                <th>Feedback</th>
                <th>Evidence</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($data as $row)
                <tr>
                    <td>{{ $row->date }}</td>
                    <td>{{ $row->name }}</td>
                    <td>{{ $row->univ ?: '-' }}</td>
                    <td>{{ $row->jurusan ?: '-' }}</td>
                    <td>{{ $row->job_position ?: '-' }}</td>
                    <td>{{ $row->mentor_name ?: '-' }}</td>
                    <td>{{ $row->activity }}</td>
                    <td style="text-transform: capitalize;">{{ $row->status }}</td>
                    <td>{{ $row->feedback ?: '-' }}</td>
                    <td>
                        @if (!empty($row->files))
                            @foreach ($row->files as $file)
                                @php
                                    $extension = strtolower(pathinfo($file->path, PATHINFO_EXTENSION));
                                    $isImage = in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp']);
                                    $base64 = null;

                                    // --- LOGIKA BASE64 (Supaya gambar muncul) ---
                                    if ($isImage) {
                                        // 1. Try public_path (works if php artisan storage:link is OK)
                                        $path = public_path($file->path);
                                        
                                        // 2. Try storage_path as fallback (bypasses symlink issues)
                                        if (!file_exists($path)) {
                                            $cleanPath = str_replace('storage/', '', $file->path);
                                            $path = storage_path('app/public/' . $cleanPath);
                                        }

                                        if (file_exists($path)) {
                                            $dataImage = file_get_contents($path);
                                            $base64 =
                                                'data:image/' . $extension . ';base64,' . base64_encode($dataImage);
                                        }
                                    }
                                @endphp

                                @if ($isImage && $base64)
                                    <div style="margin-bottom: 5px;">
                                        <img src="{{ $base64 }}"
                                            style="max-width: 80px; max-height: 80px; border: 1px solid #ccc;">
                                        <div style="font-size: 8px; color: #666;">{{ $file->name }}</div>
                                    </div>
                                @elseif($isImage && !$base64)
                                    <div style="color: red; font-size: 10px;">Img not found</div>
                                @else
                                    <div style="font-size: 10px; margin-bottom: 2px;">
                                        File: {{ $file->name }}
                                    </div>
                                @endif
                            @endforeach
                        @else
                            -
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>

</html>
