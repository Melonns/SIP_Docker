# SIP (Sistem Informasi Pemagangan) - Docker Deployment

Repository ini berisi konfigurasi Docker untuk menjalankan aplikasi **SIP** secara lokal baik untuk Frontend maupun Backend.

## 🛠️ Cara Menjalankan Aplikasi

Pastikan Anda sudah menginstal **Docker Desktop** dan **Git** di komputer Anda.

1. **Clone Repository**
   ```bash
   git clone https://github.com/Melonns/SIP_Docker.git
   cd SIP_Docker
   ```

2. **Nyalakan Container**
   Jalankan perintah berikut untuk mengunduh image, membuat volume, dan menyalakan semua service:
   ```bash
   docker compose up -d
   ```

3. **Tunggu Hingga Container Siap**
   Tunggu hingga proses instalasi selesai. Anda bisa memantau log instalasi dengan perintah:
   ```bash
   docker compose logs -f backend-fpm
   ```
   Tunggu sampai muncul tulisan **`✨ Container ready!`** di log. Aplikasi SIP sudah siap digunakan!

---

## 🔑 List Akun Siap Pakai (Data Testing)

Anda dapat masuk ke aplikasi menggunakan kredensial berikut sesuai dengan role masing-masing:

### 👤 Admin Panel
* **Email:** `admin@internhub.com`
* **Password:** `admin123`
* **Role:** Administrator / HR

### 👨‍🏫 Mentor Panel
* **Email:** `mentor.testing@sier.id`
* **Password:** `password123`
* **Role:** Supervisor / Mentor

### 🧑‍🎓 Intern (Mahasiswa Magang)
* **Password Default:** `password123`
* **List Email Akun:**
  * `intern.active@sier.id` (Intern Active)
  * `intern.complete@sier.id` (Intern Complete)
  * `budi.santoso@student.univ.ac.id` (Budi Santoso)
  * `dewi.lestari@student.univ.ac.id` (Dewi Lestari)
  * `rian.hidayat@samudra.ac.id` (Rian Hidayat)
  * `ahmad.fauzi@student.univ.ac.id` (Ahmad Fauzi)
  * `siti.aisyah@student.univ.ac.id` (Siti Aisyah)
  * `farhan.hakim@student.univ.ac.id` (Farhan Hakim)

---

## 🌐 Informasi Port & URL Layanan

Setelah aplikasi berjalan, Anda dapat mengakses berbagai service berikut dari browser Anda:

* **Frontend App:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:8000](http://localhost:8000)
* **Database Manager (phpMyAdmin):** [http://localhost:8080](http://localhost:8080)
  * *Kredensial DB:* User: `root` | Password: `sip_root_password`
* **Email Mock Server (Mailpit):** [http://localhost:8025](http://localhost:8025)

---

## 🧹 Cara Reset Database / Hapus Data
Jika Anda ingin mengosongkan database dan memulai ulang data dari awal:
```bash
docker compose down -v
docker compose up -d
```
