# VailsTT Downloader API Server

Server Node.js untuk mendownload video dari YouTube, Instagram, Twitter, Facebook, dan Pinterest.

## Platform yang Didukung

| Platform  | Module/Sumber                          | Fallback              |
|-----------|----------------------------------------|-----------------------|
| YouTube   | @distube/ytdl-core → Invidious        | Cobalt → Y2Mate       |
| Instagram | Cobalt → SnapSave                     | SaveInsta             |
| Twitter/X | fxtwitter API → Cobalt                | TwitSave              |
| Facebook  | Cobalt → GetFVid                      | FbDown                |
| Pinterest | Page scrape → Cobalt                  | —                     |

## Deploy ke Railway (GRATIS)

1. Push ke GitHub:
```bash
git init
git add .
git commit -m "VailsTT API Server"
git remote add origin https://github.com/USERNAME/vailstt-api.git
git push -u origin main
```

2. Buka https://railway.app → New Project → Deploy from GitHub
3. Pilih repo → Railway otomatis deploy
4. Klik domain yang diberikan (contoh: `vailstt-api.up.railway.app`)

## Deploy ke Render (GRATIS)

1. Push ke GitHub (sama seperti di atas)
2. Buka https://render.com → New Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `node index.js`
6. Klik **Create Web Service**

## Setelah Deploy

Update `SERVER_BASE` di `MainActivity.java`:
```java
private static final String SERVER_BASE = "https://NAMA-APP.up.railway.app";
```

## Test API

```bash
# YouTube video
curl "https://SERVER/yt?url=https://youtube.com/watch?v=dQw4w9WgXcQ&type=video"

# YouTube MP3
curl "https://SERVER/yt?url=https://youtube.com/watch?v=dQw4w9WgXcQ&type=mp3"

# Instagram
curl "https://SERVER/ig?url=https://www.instagram.com/p/XXXXX/"

# Twitter
curl "https://SERVER/tw?url=https://twitter.com/user/status/123456"

# Facebook
curl "https://SERVER/fb?url=https://www.facebook.com/watch?v=123456"

# Pinterest
curl "https://SERVER/pin?url=https://www.pinterest.com/pin/123456"
```

## Response Format

```json
{
  "ok": true,
  "source": "ytdl-core",
  "url": "https://...",
  "title": "Video Title",
  "thumb": "https://...",
  "ext": "mp4"
}
```
