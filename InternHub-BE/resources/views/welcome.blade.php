<!DOCTYPE html>
<html >
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Helvetica', Arial, sans-serif; color: #333; margin: 30px; }
        .header { text-align: center; border-bottom: 2px solid #203266; padding-bottom: 15px; margin-bottom: 30px; }
        .logo { height: 50px; margin-bottom: 10px; }
        .title { font-size: 22px; font-weight: bold; color: #203266; margin: 0; text-transform: uppercase; }
        .summary-box { background: #F1F5F9; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
        .summary-item { margin-bottom: 8px; font-size: 14px; }
        .chart-section { text-align: center; margin-top: 20px; }
        .chart-img { width: 100%; max-width: 550px; border: 1px solid #CBD5E1; border-radius: 8px; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #94A3B8; }
    </style>
</head>
<body>
    @php
        $adminData = $adminData ?? [];
        $filterPeriod = $adminData['filter_period'] ?? ['start' => '-', 'end' => '-'];
        $users = $adminData['users'] ?? [];
        $interns = $adminData['interns'] ?? [];
        $endingSoon = $interns['ending_soon'] ?? [];
        $chartBase64 = $chartBase64 ?? null;
    @endphp
    <div class="header">
        <div class="title">Laporan Dashboard Internship</div>
        <div style="font-size: 12px; color: #64748B;">Periode: {{ $filterPeriod['start'] }} - {{ $filterPeriod['end'] }}</div>
    </div>

    <div class="summary-box">
        <div style="font-weight: bold; margin-bottom: 15px; color: #203266; border-left: 4px solid #203266; padding-left: 10px;">RINGKASAN PROGRAM</div>
        <div class="summary-item">Total Interns: <strong>{{ $users['intern'] ?? 0 }}</strong></div>
        <div class="summary-item">Total Universities: <strong>{{ $interns['universitas_available_count'] ?? 0 }}</strong></div>
        <div class="summary-item">Internships Ending Soon: <strong>{{ $endingSoon['count'] ?? 0 }}</strong></div>
        <div class="summary-item">Active Interns (Current): <strong>{{ $interns['active_count'] ?? 0 }}</strong></div>
    </div>

    <div class="chart-section">
        <div style="font-weight: bold; margin-bottom: 15px; text-align: left; color: #203266;">TREN KEHADIRAN BULANAN</div>
        @if($chartBase64)
            <img src="data:image/png;base64,{{ $chartBase64 }}" class="chart-img">
        @else
            <div style="color: #EF4444; border: 1px dashed #EF4444; padding: 20px; border-radius: 8px;">
                Gagal memuat grafik. Pastikan koneksi server ke QuickChart aktif.
            </div>
        @endif
    </div>

    <div class="footer">
        Dicetak secara otomatis oleh sistem SIP-BE pada {{ date('d/m/Y H:i:s') }}
    </div>
</body>
</html>