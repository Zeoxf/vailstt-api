"use strict";

const ytDlpExec = require("yt-dlp-exec");

// ── Simple in-memory cache ────────────────────────────────────
const CACHE = new Map();
const CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX     = 200;

function cacheSet(key, value) {
  if (CACHE.size >= CACHE_MAX) {
    // Evict oldest entry
    const first = CACHE.keys().next().value;
    CACHE.delete(first);
  }
  CACHE.set(key, { value, ts: Date.now() });
}

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}

// ── Platform detector ─────────────────────────────────────────
const PLATFORM_PATTERNS = [
  { name: "youtube",     re: /youtu\.?be|youtube\.com/i },
  { name: "tiktok",      re: /tiktok\.com|vm\.tiktok/i },
  { name: "instagram",   re: /instagram\.com|instagr\.am/i },
  { name: "facebook",    re: /facebook\.com|fb\.watch|fb\.com/i },
  { name: "twitter",     re: /twitter\.com|x\.com|t\.co/i },
  { name: "vimeo",       re: /vimeo\.com/i },
  { name: "dailymotion", re: /dailymotion\.com|dai\.ly/i },
  { name: "reddit",      re: /reddit\.com|redd\.it/i },
  { name: "twitch",      re: /twitch\.tv/i },
  { name: "pinterest",   re: /pinterest\.com|pin\.it/i },
  { name: "soundcloud",  re: /soundcloud\.com/i },
  { name: "bilibili",    re: /bilibili\.com|b23\.tv/i },
];

function detectPlatform(url) {
  for (const { name, re } of PLATFORM_PATTERNS) {
    if (re.test(url)) return name;
  }
  return "unknown";
}

// ── yt-dlp runner with retry ──────────────────────────────────
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES        = 2;

async function runYtDlp(url, flags, attempt = 0) {
  try {
    const result = await Promise.race([
      ytDlpExec(url, flags),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("yt-dlp request timed out")), REQUEST_TIMEOUT_MS)
      ),
    ]);
    return result;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`[yt-dlp] Retry ${attempt + 1}/${MAX_RETRIES} for ${url} — ${err.message}`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      return runYtDlp(url, flags, attempt + 1);
    }
    throw err;
  }
}

// ── getInfo  ─────────────────────────────────────────────────
async function getInfo(url) {
  const cacheKey = `info:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[CACHE] hit — info ${url}`);
    return cached;
  }

  const raw = await runYtDlp(url, {
    dumpSingleJson: true,
    noWarnings:     true,
    noCallHome:     true,
    preferFreeFormats: true,
    skipDownload:   true,
    // Don't print progress to stderr
    quiet:          true,
  });

  cacheSet(cacheKey, raw);
  return raw;
}

// ── getFormats ────────────────────────────────────────────────
async function getFormats(url) {
  const info = await getInfo(url);
  const formats = (info.formats || []).map(f => ({
    format_id: f.format_id,
    quality:   f.format_note || f.resolution || "unknown",
    ext:       f.ext,
    filesize:  f.filesize || f.filesize_approx || null,
    vcodec:    f.vcodec !== "none" ? f.vcodec : null,
    acodec:    f.acodec !== "none" ? f.acodec : null,
    fps:       f.fps    || null,
    tbr:       f.tbr    || null,
    width:     f.width  || null,
    height:    f.height || null,
    url:       f.url    || null,
  }));
  return formats;
}

// ── getBestUrls ───────────────────────────────────────────────
// Returns { video_url, audio_url, quality }
async function getBestUrls(url) {
  const cacheKey = `best:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[CACHE] hit — best ${url}`);
    return cached;
  }

  const info    = await getInfo(url);
  const formats = info.formats || [];

  // Pick best video-only (highest res mp4)
  const videoFormats = formats
    .filter(f => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"))
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  // Pick best audio-only
  const audioFormats = formats
    .filter(f => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
    .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

  // Pick best combined (video+audio in one)
  const mergedFormats = formats
    .filter(f => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const best = {
    video_url:  videoFormats[0]?.url  || null,
    audio_url:  audioFormats[0]?.url  || null,
    merged_url: mergedFormats[0]?.url || null,
    quality:    videoFormats[0] ? `${videoFormats[0].height}p` : (mergedFormats[0] ? `${mergedFormats[0].height}p` : "unknown"),
  };

  cacheSet(cacheKey, best);
  return best;
}

// ── buildDownloadList ─────────────────────────────────────────
// Returns the "downloads" array for /api/vailstt
async function buildDownloadList(url) {
  const cacheKey = `vailstt:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[CACHE] hit — vailstt ${url}`);
    return cached;
  }

  const info    = await getInfo(url);
  const formats = info.formats || [];

  const downloads = [];

  // ── Video qualities ─────────────────────────────────────────
  const HEIGHT_TARGETS = [2160, 1440, 1080, 720, 480, 360, 240];
  const seen = new Set();

  for (const target of HEIGHT_TARGETS) {
    // Look for combined (video+audio) first, then video-only
    const combined = formats
      .filter(f =>
        f.vcodec && f.vcodec !== "none" &&
        f.acodec && f.acodec !== "none" &&
        f.url && f.height && f.height <= target
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    const videoOnly = formats
      .filter(f =>
        f.vcodec && f.vcodec !== "none" &&
        (!f.acodec || f.acodec === "none") &&
        f.url && f.height && f.height <= target
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    const best = combined || videoOnly;
    if (best && !seen.has(best.height)) {
      seen.add(best.height);
      downloads.push({
        type:     "video",
        quality:  `${best.height}p`,
        ext:      best.ext || "mp4",
        filesize: best.filesize || best.filesize_approx || null,
        url:      best.url,
        has_audio: !!(best.acodec && best.acodec !== "none"),
      });
    }
  }

  // ── Audio ─────────────────────────────────────────────────
  const audioFormats = formats
    .filter(f => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none") && f.url)
    .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

  if (audioFormats[0]) {
    downloads.push({
      type:     "audio",
      quality:  "mp3",
      ext:      audioFormats[0].ext || "m4a",
      filesize: audioFormats[0].filesize || null,
      url:      audioFormats[0].url,
      has_audio: true,
    });
  }

  // ── Fallback: if no structured formats, use direct_url ────
  if (downloads.length === 0 && info.url) {
    downloads.push({
      type:      "video",
      quality:   info.format_note || "best",
      ext:       info.ext || "mp4",
      filesize:  null,
      url:       info.url,
      has_audio: true,
    });
  }

  cacheSet(cacheKey, downloads);
  return downloads;
}

module.exports = {
  detectPlatform,
  getInfo,
  getFormats,
  getBestUrls,
  buildDownloadList,
};
