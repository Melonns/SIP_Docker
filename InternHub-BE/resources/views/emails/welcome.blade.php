<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            color: #007bff;
            font-size: 28px;
        }
        .content {
            margin-bottom: 20px;
        }
        .content p {
            margin: 10px 0;
        }
        .credentials {
            background-color: #f9f9f9;
            border-left: 4px solid #28a745;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .credentials p {
            margin: 8px 0;
            font-size: 14px;
        }
        .credentials strong {
            display: inline-block;
            width: 130px;
            color: #333;
        }
        .credentials .value {
            background-color: #ffffff;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
        }
        .important-note {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 14px;
        }
        .important-note strong {
            color: #856404;
        }
        .action-button {
            display: inline-block;
            background-color: #007bff;
            color: #ffffff;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 15px;
            font-weight: bold;
        }
        .action-button:hover {
            background-color: #0056b3;
        }
        .footer {
            text-align: center;
            border-top: 1px solid #ddd;
            padding-top: 15px;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
        }
        .role-badge {
            display: inline-block;
            padding: 5px 10px;
            background-color: #007bff;
            color: #ffffff;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Selamat Datang di SIP!</h1>
        </div>

        <div class="content">
            <p>Halo <strong>{{ $nama }}</strong>,</p>
            
            <p>Kami dengan senang hati menyambut Anda sebagai bagian dari sistem SIP. Akun Anda telah berhasil dibuat dan siap digunakan.</p>

            <div class="credentials">
                <p><strong>Email:</strong> <span class="value">{{ $email }}</span></p>
                <p><strong>Identifier:</strong> <span class="value">{{ $identifier }}</span></p>
                <p><strong>Password:</strong> <span class="value">{{ $password }}</span></p>
                <p><strong>Role:</strong> <span class="role-badge">{{ ucfirst($role) }}</span></p>
            </div>

            <div class="important-note">
                <strong>⚠️ Penting:</strong> 
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Simpan password Anda dengan aman. Jangan bagikan kepada siapapun.</li>
                    <li>Segera login dan ubah password Anda ke password yang lebih aman setelah login pertama.</li>
                    <li>Jika Anda lupa password, gunakan fitur "Lupa Password" di halaman login.</li>
                </ul>
            </div>

            <p><strong>Langkah Selanjutnya:</strong></p>
            <ol>
                <li>Login ke sistem dengan email dan password di atas</li>
                <li>Lengkapi profil Anda dengan informasi lengkap</li>
                <li>Sesuaikan pengaturan akun Anda sesuai kebutuhan</li>
            </ol>

            <p style="text-align: center; margin-top: 30px;">
                <a href="{{ env('APP_URL', 'http://localhost') }}/login" class="action-button">Login ke SIP</a>
            </p>
        </div>

        <div class="footer">
            <p>Jika Anda memiliki pertanyaan atau memerlukan bantuan, silakan hubungi tim support kami.</p>
            <p>&copy; {{ date('Y') }} SIP. Semua hak dilindungi.</p>
        </div>
    </div>
</body>
</html>
