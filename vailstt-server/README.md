# VailsTT Server v3

**Universal Video Downloader API** — powered by `yt-dlp`.  
Backend untuk aplikasi Android **VailsTT**, mendukung YouTube, TikTok, Instagram, Facebook, X/Twitter, Vimeo, Dailymotion, Reddit, Twitch, dan 1000+ platform lainnya.

---

## Stack

| Komponen | Library |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Downloader engine | yt-dlp-exec |
| Merger video/audio | ffmpeg |
| Security | helmet |
| Compression | compression |
| CORS | cors |
| Rate limiting | express-rate-limit |
| Logging | morgan |

---

## Struktur Folder

```
vailstt-server/
├── src/
│   ├── index.js          ← Entry point, middleware, server
│   ├── routes/
│   │   └── api.js        ← Semua endpoint API
│   └── lib/
│       └── ytdlp.js      ← yt-dlp wrapper, cache, platform detector
├── docs/
│   └── vailstt.postman_collection.json
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── Procfile
├── railway.json
├── package.json
└── README.md
```

---

## Endpoints

### `GET /api/health`
Cek status server.

```json
{
  "success": true,
  "status": "online",
  "uptime": 12345,
  "version": "3.0.0",
  "engine": "yt-dlp"
}
```

---

### `GET /api/info?url=`
Informasi lengkap video + semua format tersedia.

```
GET /api/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

```json
{
  "success": true,
  "platform": "youtube",
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "description": "...",
    "duration": 213,
    "uploader": "Rick Astley",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "view_count": 1400000000,
    "like_count": 16000000,
    "upload_date": "20091024",
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "formats": [
      {
        "format_id": "137",
        "quality": "1080p",
        "ext": "mp4",
        "filesize": 102400000,
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "vcodec": "avc1.640028",
        "acodec": null,
        "url": "https://..."
      }
    ]
  }
}
```

---

### `GET /api/formats?url=`
Daftar semua format yang tersedia.

```json
{
  "success": true,
  "platform": "youtube",
  "data": [
    {
      "format_id": "137",
      "quality": "1080p",
      "ext": "mp4",
      "filesize": 102400000,
      "vcodec": "avc1.640028",
      "acodec": null,
      "fps": 30,
      "width": 1920,
      "height": 1080,
      "url": "https://..."
    },
    {
      "format_id": "140",
      "quality": "audio only",
      "ext": "m4a",
      "filesize": 3500000,
      "vcodec": null,
      "acodec": "mp4a.40.2",
      "fps": null,
      "url": "https://..."
    }
  ]
}
```

---

### `GET /api/download?url=`
URL download terbaik (video + audio + merged).

```json
{
  "success": true,
  "platform": "youtube",
  "data": {
    "title": "Rick Astley - Never Gonna Give You Up",
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "duration": 213,
    "uploader": "Rick Astley",
    "video_url": "https://...",
    "audio_url": "https://...",
    "merged_url": "https://...",
    "quality": "1080p"
  }
}
```

---

### `GET /api/audio?url=`
URL stream audio saja.

```json
{
  "success": true,
  "platform": "youtube",
  "data": {
    "audio_url": "https://...",
    "title": "Rick Astley - Never Gonna Give You Up",
    "thumbnail": "https://...",
    "duration": 213,
    "uploader": "Rick Astley"
  }
}
```

---

### `GET /api/vailstt?url=` ⭐ Endpoint Android
Endpoint utama untuk aplikasi Android VailsTT.  
Response sudah diformat agar langsung bisa ditampilkan tanpa parsing tambahan.

```
GET /api/vailstt?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

```json
{
  "success": true,
  "title": "Rick Astley - Never Gonna Give You Up",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 213,
  "platform": "youtube",
  "uploader": "Rick Astley",
  "downloads": [
    {
      "type": "video",
      "quality": "1080p",
      "ext": "mp4",
      "filesize": 102400000,
      "url": "https://...",
      "has_audio": false
    },
    {
      "type": "video",
      "quality": "720p",
      "ext": "mp4",
      "filesize": 54000000,
      "url": "https://...",
      "has_audio": false
    },
    {
      "type": "audio",
      "quality": "mp3",
      "ext": "m4a",
      "filesize": 3500000,
      "url": "https://...",
      "has_audio": true
    }
  ]
}
```

---

### Response Error

Semua error menggunakan format konsisten:

```json
{
  "success": false,
  "error": "Pesan error yang deskriptif"
}
```

| Status | Kondisi |
|---|---|
| 400 | URL tidak diberikan atau tidak valid |
| 403 | Konten private / butuh login |
| 404 | Stream tidak ditemukan |
| 429 | Rate limit |
| 502 | yt-dlp gagal |
| 504 | Timeout |

---

## Rate Limiting

| Endpoint | Limit |
|---|---|
| `/api/*` (global) | 100 req / 15 menit |
| `/api/download` | 15 req / menit |
| `/api/vailstt` | 15 req / menit |

---

## Platform yang Didukung

| Platform | URL Contoh |
|---|---|
| YouTube | `https://youtube.com/watch?v=...` |
| YouTube Shorts | `https://youtube.com/shorts/...` |
| TikTok | `https://tiktok.com/@user/video/...` |
| Instagram | `https://instagram.com/p/...` |
| Instagram Reels | `https://instagram.com/reel/...` |
| Facebook | `https://facebook.com/watch?v=...` |
| X / Twitter | `https://x.com/user/status/...` |
| Vimeo | `https://vimeo.com/...` |
| Dailymotion | `https://dailymotion.com/video/...` |
| Reddit | `https://reddit.com/r/.../comments/...` |
| Twitch (Clips) | `https://clips.twitch.tv/...` |
| Pinterest | `https://pinterest.com/pin/...` |
| SoundCloud | `https://soundcloud.com/...` |
| Bilibili | `https://bilibili.com/video/...` |
| + 1000 lainnya | Semua yang didukung yt-dlp |

---

## Instalasi & Jalankan Lokal

### 1. Clone dan Install

```bash
git clone https://github.com/USERNAME/vailstt-server.git
cd vailstt-server
npm install
```

### 2. Install yt-dlp

**macOS:**
```bash
brew install yt-dlp
```

**Ubuntu / Debian:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows:**
```powershell
winget install yt-dlp
# atau
scoop install yt-dlp
```

### 3. Install ffmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu / Debian:**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

**Windows:**
```powershell
winget install Gyan.FFmpeg
# atau
scoop install ffmpeg
```

### 4. Konfigurasi Environment

```bash
cp .env.example .env
# Edit .env sesuai kebutuhan
```

### 5. Jalankan

```bash
# Development
npm run dev

# Production
npm start
```

Server akan berjalan di `http://localhost:3000`.

---

## Deploy ke Railway

Railway adalah platform gratis terbaik untuk backend Node.js.

### Langkah-langkah:

**1. Push ke GitHub:**
```bash
git init
git add .
git commit -m "VailsTT Server v3"
git branch -M main
git remote add origin https://github.com/USERNAME/vailstt-server.git
git push -u origin main
```

**2. Deploy di Railway:**
1. Buka [railway.app](https://railway.app)
2. Klik **New Project → Deploy from GitHub Repo**
3. Pilih repo `vailstt-server`
4. Railway otomatis mendeteksi Node.js dan deploy

**3. Install yt-dlp di Railway (Nixpacks):**

Buat file `nixpacks.toml` di root project:
```toml
[phases.setup]
nixPkgs = ["yt-dlp", "ffmpeg"]
```

**4. Dapatkan URL:**
- Railway memberikan URL seperti: `vailstt-server.up.railway.app`
- Update `SERVER_BASE` di Android app:
  ```java
  private static final String SERVER_BASE = "https://vailstt-server.up.railway.app";
  ```

---

## Deploy ke VPS Ubuntu

### 1. Setup server baru (Ubuntu 22.04)

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install ffmpeg
sudo apt install -y ffmpeg

# Install yt-dlp
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Verify
node --version    # v20.x.x
ffmpeg -version   # ffmpeg version 6.x
yt-dlp --version  # 2024.x.x
```

### 2. Clone dan setup project

```bash
git clone https://github.com/USERNAME/vailstt-server.git /var/www/vailstt-server
cd /var/www/vailstt-server
npm install --omit=dev
cp .env.example .env
```

### 3. Setup PM2 (process manager)

```bash
sudo npm install -g pm2

# Start server
pm2 start src/index.js --name vailstt-server

# Auto-start on reboot
pm2 startup
pm2 save
```

### 4. Setup Nginx reverse proxy

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/vailstt
```

Isi file:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vailstt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL dengan Certbot (opsional tapi disarankan)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

### 6. Update yt-dlp secara rutin (cron)

```bash
# Update yt-dlp setiap minggu
echo "0 3 * * 0 /usr/local/bin/yt-dlp -U" | sudo crontab -
```

---

## Deploy dengan Docker

```bash
# Build image
docker build -t vailstt-server .

# Jalankan container
docker run -d \
  --name vailstt-server \
  -p 3000:3000 \
  --restart unless-stopped \
  vailstt-server

# Atau pakai docker-compose
docker compose up -d
```

---

## Contoh Request

### curl

```bash
# Health check
curl http://localhost:3000/api/health

# Info video YouTube
curl "http://localhost:3000/api/info?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Format tersedia
curl "http://localhost:3000/api/formats?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Download URL terbaik
curl "http://localhost:3000/api/download?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# Audio saja
curl "http://localhost:3000/api/audio?url=https://youtube.com/watch?v=dQw4w9WgXcQ"

# TikTok
curl "http://localhost:3000/api/vailstt?url=https://www.tiktok.com/@user/video/1234567890"

# Instagram Reels
curl "http://localhost:3000/api/vailstt?url=https://www.instagram.com/reel/XXXXX/"

# Twitter/X
curl "http://localhost:3000/api/vailstt?url=https://x.com/user/status/1234567890"

# Vimeo
curl "http://localhost:3000/api/vailstt?url=https://vimeo.com/123456789"
```

### Android (OkHttp / Retrofit)

```java
// Contoh dengan OkHttp
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build();

String encodedUrl = URLEncoder.encode(videoUrl, "UTF-8");
Request request = new Request.Builder()
    .url("https://YOUR-SERVER/api/vailstt?url=" + encodedUrl)
    .build();

client.newCall(request).enqueue(new Callback() {
    @Override
    public void onResponse(Call call, Response response) throws IOException {
        String json = response.body().string();
        // Parse JSON → tampilkan downloads list
    }
});
```

---

## Catatan Penting

- **yt-dlp URL bersifat sementara** — URL yang dikembalikan oleh yt-dlp biasanya expire dalam beberapa jam. Jangan cache di sisi Android terlalu lama.
- **Instagram & TikTok** memerlukan cookies untuk konten private. Versi public sudah didukung.
- **YouTube** menggunakan direct streaming URL dari yt-dlp, lebih stabil dari ytdl-core.
- **has_audio: false** artinya stream video perlu digabung dengan audio stream secara manual di Android (atau gunakan `merged_url` jika tersedia).
- Update yt-dlp secara berkala agar tidak break saat platform target update.

---

## License

MIT — bebas digunakan untuk proyek pribadi maupun komersial.
