<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Informasi Akun SIP</title>
    <style>
        /* Modern Font Stack */
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7f6;
            margin: 0;
            padding: 40px 0;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #e1e5ea;
        }
        /* Corporate Header */
        .header {
            background-color: #0F4C81; /* Corporate Blue */
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .content {
            padding: 40px 30px;
            color: #334155;
            line-height: 1.6;
            font-size: 15px;
        }
        .content p {
            margin-bottom: 16px;
        }
        /* Sleek Credentials Box */
        .credentials-box {
            background-color: #f8fafc;
            border-left: 4px solid #0F4C81;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 6px 6px 0;
        }
        .credentials-box .row {
            margin-bottom: 10px;
        }
        .credentials-box .row:last-child {
            margin-bottom: 0;
        }
        .credentials-box .label {
            color: #64748b;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 4px;
        }
        .credentials-box .value {
            color: #0f172a;
            font-family: 'Courier New', Courier, monospace;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 1px;
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
        }
        /* Security Notice */
        .important {
            background-color: #fffbeb;
            border: 1px solid #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            border-radius: 0 6px 6px 0;
            margin: 25px 0;
            font-size: 14px;
        }
        .important strong {
            color: #b45309;
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .important p {
            margin: 0;
            color: #92400e;
        }
        /* Modern Button */
        .action-button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #0F4C81;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 25px 0;
            text-align: center;
            transition: background-color 0.3s;
        }
        .action-button:hover {
            background-color: #0a365c;
        }
        /* Clean List */
        .steps {
            padding-left: 20px;
            margin-bottom: 25px;
        }
        .steps li {
            margin-bottom: 10px;
            color: #475569;
        }
        .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            color: #94a3b8;
            font-size: 13px;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SIP</h1>
        </div>

        <div class="content">
            <p>Yth. <strong>{{ $user->nama }}</strong>,</p>

            <p>Selamat bergabung. Akun Anda telah berhasil dibuat dan didaftarkan ke dalam sistem SIP. Berikut adalah informasi kredensial yang dapat digunakan untuk mengakses akun Anda:</p>

            <div class="credentials-box">
                <div class="row">
                    <span class="label">Alamat Email</span>
                    <span class="value">{{ $user->email }}</span>
                </div>
                <div class="row">
                    <span class="label">Password Sementara</span>
                    <span class="value">{{ $password }}</span>
                </div>
            </div>

            <div class="important">
                <strong>Pemberitahuan Keamanan</strong>
                <p>Sistem mewajibkan Anda untuk segera mengganti password sementara ini setelah login pertama kali. Pastikan Anda menggunakan kombinasi password yang kuat dan rahasia.</p>
            </div>

            <center>
                <a href="{{ $login_url }}" class="action-button">Akses SIP Sekarang</a>
            </center>

            <p style="font-size: 13px; color: #64748b; margin-top: -10px; text-align: center;">
                Atau salin tautan berikut ke browser Anda:<br>
                <a href="{{ $login_url }}" style="color: #0F4C81; word-break: break-all;">{{ $login_url }}</a>
            </p>

            <p><strong>Panduan Akses Pertama:</strong></p>
            <ol class="steps">
                <li>Klik tombol akses di atas untuk membuka halaman login.</li>
                <li>Gunakan email dan password sementara yang tertera.</li>
                <li>Ikuti instruksi di layar untuk memperbarui password Anda.</li>
                <li>Anda sudah dapat menggunakan seluruh fitur SIP.</li>
            </ol>

            <p>Jika Anda mengalami kendala teknis saat mengakses akun, silakan hubungi tim Administrator.</p>

            <p>Hormat kami,<br>
            <strong>Tim Administrator SIP</strong></p>
        </div>

        <div class="footer">
            <p>&copy; {{ date('Y') }} SIP. Hak cipta dilindungi undang-undang.</p>
            <p>Pesan otomatis ini dikirimkan khusus untuk {{ $user->email }}</p>
        </div>
    </div>
</body>
</html>