<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Keamanan Akun SIP</title>
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
            font-size: 22px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        /* Content Area */
        .content {
            padding: 40px 30px;
            color: #334155;
            line-height: 1.6;
            font-size: 15px;
        }
        .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #0f172a;
        }
        /* Sleek OTP Box */
        .otp-wrapper {
            text-align: center;
            margin: 30px 0;
            padding: 25px 20px;
            background-color: #f8fafc;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }
        .otp-label {
            display: block;
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 12px;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .otp-code {
            font-family: 'Courier New', Courier, monospace;
            font-size: 38px;
            color: #0F4C81;
            letter-spacing: 8px;
            font-weight: 700;
            display: block;
            background: #ffffff;
            padding: 10px;
            border-radius: 4px;
            border: 1px dashed #cbd5e1;
            width: fit-content;
            margin: 0 auto;
        }
        /* Security Notice */
        .warning-text {
            background-color: #fffbeb;
            border: 1px solid #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            border-radius: 0 6px 6px 0;
            margin: 30px 0;
            font-size: 14px;
        }
        .warning-text strong {
            color: #b45309;
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .warning-text p {
            margin: 0;
            color: #92400e;
        }
        /* Footer */
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
            <h1>Verifikasi Keamanan Akun</h1>
        </div>

        <div class="content">
            <div class="greeting">Yth. {{ $user->nama }},</div>

            <p>Sistem kami menerima permintaan untuk melakukan pengaturan ulang kata sandi (<em>reset password</em>) pada akun <strong>SIP</strong> Anda.</p>

            <p>Sebagai langkah verifikasi keamanan, silakan gunakan kode <em>One-Time Password</em> (OTP) berikut untuk melanjutkan proses tersebut:</p>

            <div class="otp-wrapper">
                <span class="otp-label">Kode Verifikasi Anda</span>
                <span class="otp-code">{{ $token }}</span>
            </div>

            <div class="warning-text">
                <strong>Pemberitahuan Keamanan</strong>
                <p>Kode ini bersifat sangat rahasia dan hanya berlaku selama <strong>10 menit</strong> Mohon untuk tidak memberikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai Administrator PT SIER.</p>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 25px;">
                Jika Anda merasa tidak pernah meminta pengaturan ulang kata sandi, mohon abaikan email ini. Akun Anda tetap dalam keadaan aman.
            </p>

            <p style="margin-top: 30px; margin-bottom: 0;">
                Hormat kami,<br>
                <strong>Tim Administrator SIP</strong><br>
                <span style="font-size: 13px; color: #64748b;">PT Surabaya Industrial Estate Rungkut (SIER)</span>
            </p>
        </div>

        <div class="footer">
            <p>&copy; {{ date('Y') }} PT SIER. Hak cipta dilindungi undang-undang.</p>
            <p>Pesan otomatis ini dikirimkan khusus untuk {{ $user->email }}</p>
        </div>
    </div>
</body>
</html>