<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Sertifikat & Transkrip</title>
    <style>
        /* Load Poppins: prefer local files (self-host) for PDF renderer reliability */
        @if(empty($using_dompdf))
            @font-face {
                font-family: 'PoppinsLocal';
                src: url('/fonts/Poppins-300.ttf') format('truetype');
                font-weight: 300;
            }
            @font-face {
                font-family: 'PoppinsLocal';
                src: url('/fonts/Poppins-400.ttf') format('truetype');
                font-weight: 400;
            }
            @font-face {
                font-family: 'PoppinsLocal';
                src: url('/fonts/Poppins-600.ttf') format('truetype');
                font-weight: 600;
            }
            @font-face {
                font-family: 'PoppinsLocal';
                src: url('/fonts/Poppins-700.ttf') format('truetype');
                font-weight: 700;
            }
            @font-face {
                font-family: 'PoppinsLocal';
                src: url('/fonts/Poppins-800.ttf') format('truetype');
                font-weight: 800;
            }
        @else
            /* DomPDF skip complex font faces for performance */
        @endif

        /* CATATAN: Bagian @page INI TIDAK BISA DI-INLINE. */
        @page {
            margin: 0px;
            size: A4 landscape;
        }

        :root {
            --font-stack: 'PoppinsLocal', 'Poppins', 'Helvetica', sans-serif;
        }

        body {
            margin: 0px;
            padding: 0px;
            font-family: var(--font-stack);
            -webkit-font-smoothing: antialiased;
            color: #334155;
        }

        /* Ensure bold tags and small labels look consistent */
        b {
            font-weight: 700;
        }

        /* Keep certificate title and predicate in serif */
        .cert-title {
            font-family: 'Times New Roman', serif;
        }

        .predicate {
            font-family: 'Times New Roman', serif;
            font-style: italic;
        }

        /* Criteria table tighter */
        .criteria-box {
            font-size: 9px;
            width: 45%;
        }

        .criteria-box td,
        .criteria-box th {
            padding: 3px;
        }
    </style>
</head>

<body>

    <div
        style="position: relative; width: 100%; height: 100%; page-break-after: always; overflow: hidden;">

        @if(!empty($background_front))
            {{-- using <img> tag because DomPDF requires isRemoteEnabled false; CSS backgrounds
                 are treated as remote and are blocked when remote is disabled. keep styling
                 minimal to avoid color shifts (no image-rendering or object-fit). --}}
            <img src="{{ $background_front }}" 
                 style="position:absolute;top:0;left:0;width:100%;height:100%;
                        z-index:0;display:block;border:none;" />
        @endif

        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; text-align: center; z-index: 1;">

            <div style="margin-top: 8.5%;">
                <div
                    style="font-family: 'Times New Roman', serif; font-weight: 600; font-size: 60px; letter-spacing: 6px; text-transform: uppercase; color: #000000; ">
                    SERTIFIKAT
                </div>
                <div style="font-size: 13px; color: #64748b; margin-top:-2px;">
                    Nomor: {{ $data['certNumber'] }}
                </div>
            </div>

            <div style="margin-top: 30px;">
                <div style="font-size: 14px; color: #64748b; margin-bottom: 0 px;">
                    Sertifikat ini diberikan kepada
                </div>
                <div
                    style=" margin-top:-10px; font-family: var(--font-stack); font-size: 48px; font-weight: 800; color: #C5A365; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 1px;">
                    {{ $data['intern']['name'] }}
                </div>
                <div
                    style="margin-top:-10px; font-size: 16px; font-weight: 700; color: #000; font-family: var(--font-stack);">
                    {{ $data['intern']['education_level'] }} {{ $data['intern']['study_program'] }} &ndash;
                    {{ $data['intern']['university'] }}
                </div>
            </div>

            <div
                style="margin-top: 12px; font-size: 16px; line-height: 1; color: #282b2f; padding: 0 14%; font-family: var(--font-stack);">
                Telah Mengikuti <b style="font-family: var(--font-stack);">Program Magang Bersertifikat PT Surabaya
                    Industrial Estate Rungkut</b><br>
                Selama {{ $data['intern']['duration_months'] }}
                ({{ $data['intern']['duration_months_text'] ?? 'Satu' }}) Bulan ({{ $periodLabel }}) dengan Predikat:
                <div class="predicate"
                    style="font-size: 34px; font-weight: bold; color: #C5A365; margin-top: 25px; margin-bottom: 25px;">
                    &ldquo;{{ $data['predicate'] }}&rdquo;
                </div>
            </div>

            <div style="width: 100%; text-align: center; margin-top:20px;">
                <div style="font-size: 13px;  color: #282b2f; font-family: var(--font-stack);">
                    Surabaya, {{ $formattedDate }}<br>
                    PT Surabaya Industrial Estate Rungkut
                </div>

                <div style="display: inline-block; text-align: center; min-width: 300px;margin-top: -10px;">
                    <div
                        style="width: 70px; height: 70px; margin: 0 auto 10px auto; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #aaa;">
                    </div>
                    <div
                        style="font-weight: bold; border-bottom: 1px solid #000; font-size: 18px; color: #0f172a; padding-bottom: 4px; margin-bottom: 4px; display: inline-block; min-width: 250px;">
                        {{ $data['signer'] ?? 'Fitrina Kusuma Dewi' }}
                    </div>
                    <div style="font-size: 14px; margin-top: 4px; font-style: italic; color: #64748b;">
                        {{ $data['signerTitle'] ?? 'Kepala Divisi Sumber Daya Manusia' }}
                    </div>
                </div>
            </div>

        </div>
    </div>

    <div
        style="position: relative; z-index: 1; width: 100%; height: 100%; page-break-after: avoid; overflow: hidden;">

        @if(!empty($background_back))
            <img src="{{ $background_back }}" 
                 style="position:absolute;top:0;left:0;width:100%;height:100%;
                        z-index:0;display:block;border:none;" />
        @endif

        <div
            style="position: relative; padding: 110px 80px 20px; box-sizing: border-box; font-family: var(--font-stack); color: #000; z-index: 2; max-height: 100%; overflow: hidden;">

            <table style="width: 100%; margin-bottom: 10px; font-size: 11px; border-collapse: collapse;">
                <tr>
                    <td style="font-weight: bold; width: 80px; padding-bottom: 5px;">Nama</td>
                    <td style="width: 10px;">:</td>
                    <td style="width: 250px;">{{ $data['intern']['name'] }}</td>

                    <td style="font-weight: bold; width: 110px; padding-left: 20px;">Periode Magang</td>
                    <td style="width: 10px;">:</td>
                    <td>{{ $periodLabel }}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Institusi</td>
                    <td>:</td>
                    <td>{{ $data['intern']['university'] }}</td>

                    <td style="font-weight: bold; padding-left: 20px;">Penempatan</td>
                    <td>:</td>
                    <td>{{ $data['intern']['division'] ?? '-' }}</td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; color: #000; margin-bottom: 10px;">
                <thead>
                    <tr style="background-color: transparent;">
                        <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 30px; text-align: center;">
                            No.
                        </th>
                        <th rowspan="2"
                            style="border: 1px solid #000; padding: 4px; text-align: left; padding-left: 10px;">
                            Komponen</th>
                        <th colspan="2" style="border: 1px solid #000; padding: 4px; text-align: center;">Daftar Nilai
                        </th>
                    </tr>
                    <tr style="background-color: transparent;">
                        <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 60px;">Angka</th>
                        <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 60px;">Huruf</th>
                    </tr>
                </thead>
                <tbody>
                    @php $i = 1; @endphp
                    @foreach($data['formData']['scores'] as $key => $score)
                        <tr>
                            <td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">{{ $i++ }}</td>
                            <td style="border: 1px solid #000; padding: 3px 6px; text-align: left; padding-left: 10px;">
                                {{ $scoreLabels[$key] ?? ucwords(str_replace('_', ' ', $key)) }}
                            </td>
                            <td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">
                                {{ number_format((float) $score, 0) }}
                            </td>
                            <td style="border: 1px solid #000; padding: 3px 6px; text-align: center;">
                                @if($score >= 86) A @elseif($score >= 71) B @else C @endif
                            </td>
                        </tr>
                    @endforeach
                    <tr style="font-weight: bold;">
                        <td colspan="2" style="border: 1px solid #000; padding: 4px; text-align: center;">Total Nilai Mentor</td>
                        <td style="border: 1px solid #000; padding: 4px; text-align: center;">{{ array_sum($data['formData']['scores']) }}</td>
                        <td style="border: 1px solid #000; padding: 4px; text-align: center;">-</td>
                    </tr>
                    <tr style="background-color: transparent; font-weight: bold;">
                        <td colspan="2" style="border: 1px solid #000; padding: 4px; text-align: center;">Rata-rata</td>
                        <td style="border: 1px solid #000; padding: 4px; text-align: center;">{{ $data['finalScore'] }}
                        </td>
                        <td style="border: 1px solid #000; padding: 4px; text-align: center;">
                            @if($data['finalScore'] >= 86) A @elseif($data['finalScore'] >= 71) B @else C @endif
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style="font-size: 8.5px; width: 40%;">
                <div style="font-weight: bold; margin-bottom: 3px;">Kriteria Nilai:</div>
                <table style="width: 100%; border-collapse: collapse; text-align: center;">
                    <tr style="background-color: transparent;">
                        <th style="border: 1px solid #000; padding: 2px;">Rentang</th>
                        <th style="border: 1px solid #000; padding: 2px;">Keterangan</th>
                        <th style="border: 1px solid #000; padding: 2px;">Norma</th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000; padding: 2px;">86 - 100</td>
                        <td style="border: 1px solid #000; padding: 2px; text-align: left; padding-left: 5px;">Sangat
                            Memuaskan</td>
                        <td style="border: 1px solid #000; padding: 2px;">A</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000; padding: 2px;">71 - 85</td>
                        <td style="border: 1px solid #000; padding: 2px; text-align: left; padding-left: 5px;">Memuaskan
                        </td>
                        <td style="border: 1px solid #000; padding: 2px;">B</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000; padding: 2px;">0 - 70</td>
                        <td style="border: 1px solid #000; padding: 2px; text-align: left; padding-left: 5px;">Cukup
                            Memuaskan</td>
                        <td style="border: 1px solid #000; padding: 2px;">C</td>
                    </tr>
                </table>
            </div>

        </div>
    </div>
</body>

</html>