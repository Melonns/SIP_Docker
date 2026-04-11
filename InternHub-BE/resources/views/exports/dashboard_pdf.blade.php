<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @media print { img { -webkit-print-color-adjust: exact; } }
        body { font-family: 'Poppins', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; margin: 24px; }
        .header { text-align: center; border-bottom: 2px solid #203266; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; color: #203266; margin: 0; }
        .period { font-size: 14px; color: #666; }
        .summary-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        .chart-container { text-align: center; margin-top: 20px; }
        .chart-img { width: 100%; max-width: 600px; height: auto; border: 1px solid #e2e8f0; }
        .logo { max-height: 60px; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">Dashboard Export</h1>
        <p class="period">Periode: {{ $adminData['filter_period']['start'] ?? '-' }} - {{ $adminData['filter_period']['end'] ?? '-' }}</p>
    </div>

    <div class="summary-box">
        <h3>Ringkasan Program Magang</h3>
        <ul>
            <li>Total Interns: {{ $adminData['users']['intern'] ?? 0 }}</li>
            <li>Total Universities: {{ $adminData['interns']['universitas_available_count'] ?? 0 }}</li>
            <li>Ending Soon: {{ $adminData['interns']['ending_soon']['count'] ?? 0 }}</li>
            <li>Active Now: {{ $adminData['interns']['active_count'] ?? 0 }}</li>
        </ul>
    </div>

    <div class="chart-container">
        <h3>Attendance Chart</h3>
        @if(!empty($chartBase64))
            <img class="chart-img" src="data:image/png;base64,{{ $chartBase64 }}" alt="Attendance Chart">
        @else
            <p style="color: red;">Gagal memuat grafik. Periksa koneksi ke QuickChart atau coba lagi tanpa menyertakan font.</p>
        @endif
    </div>

</body>
</html>