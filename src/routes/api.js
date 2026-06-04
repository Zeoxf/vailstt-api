"use strict";

const router = require("express").Router();
const {
  detectPlatform,
  getInfo,
  getFormats,
  getBestUrls,
  buildDownloadList,
} = require("../lib/ytdlp");

// ── Helpers ───────────────────────────────────────────────────
function requireUrl(req, res) {
  const url = (req.query.url || "").trim();
  if (!url) {
    res.status(400).json({ success: false, error: "Missing required query parameter: url" });
    return null;
  }
  try {
    new URL(url); // basic validation
    return url;
  } catch {
    res.status(400).json({ success: false, error: "Invalid URL provided" });
    return null;
  }
}

function errResponse(res, err) {
  const msg = err?.message || String(err);
  console.error("[API ERROR]", msg);

  // Map yt-dlp specific errors to friendly messages
  if (msg.includes("Unsupported URL"))
    return res.status(400).json({ success: false, error: "This URL is not supported by yt-dlp" });
  if (msg.includes("Private video") || msg.includes("private"))
    return res.status(403).json({ success: false, error: "This content is private or requires authentication" });
  if (msg.includes("timed out"))
    return res.status(504).json({ success: false, error: "Request timed out. Try again." });
  if (msg.includes("429") || msg.includes("rate"))
    return res.status(429).json({ success: false, error: "Source platform is rate limiting. Try again in a moment." });

  return res.status(502).json({ success: false, error: `Download failed: ${msg}` });
}

// ─────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status:  "online",
    uptime:  Math.floor(process.uptime()),
    version: "3.0.0",
    engine:  "yt-dlp",
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/info?url=
// ─────────────────────────────────────────────────────────────
router.get("/info", async (req, res) => {
  const url = requireUrl(req, res);
  if (!url) return;

  const platform = detectPlatform(url);
  console.log(`[INFO] ${platform} — ${url}`);

  try {
    const raw = await getInfo(url);
    res.json({
      success:  true,
      platform,
      data: {
        id:           raw.id          || null,
        title:        raw.title       || null,
        description:  raw.description || null,
        duration:     raw.duration    || null,
        uploader:     raw.uploader    || raw.channel || null,
        thumbnail:    raw.thumbnail   || null,
        view_count:   raw.view_count  || null,
        like_count:   raw.like_count  || null,
        upload_date:  raw.upload_date || null,
        webpage_url:  raw.webpage_url || url,
        formats:      (raw.formats || []).map(f => ({
          format_id: f.format_id,
          quality:   f.format_note || f.resolution || null,
          ext:       f.ext,
          filesize:  f.filesize || f.filesize_approx || null,
          width:     f.width  || null,
          height:    f.height || null,
          fps:       f.fps    || null,
          vcodec:    f.vcodec !== "none" ? f.vcodec : null,
          acodec:    f.acodec !== "none" ? f.acodec : null,
          url:       f.url    || null,
        })),
      },
    });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/formats?url=
// ─────────────────────────────────────────────────────────────
router.get("/formats", async (req, res) => {
  const url = requireUrl(req, res);
  if (!url) return;

  const platform = detectPlatform(url);
  console.log(`[FORMATS] ${platform} — ${url}`);

  try {
    const formats = await getFormats(url);
    res.json({ success: true, platform, data: formats });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/download?url=
// ─────────────────────────────────────────────────────────────
router.get("/download", async (req, res) => {
  const url = requireUrl(req, res);
  if (!url) return;

  const platform = detectPlatform(url);
  console.log(`[DOWNLOAD] ${platform} — ${url}`);

  try {
    const [info, best] = await Promise.all([getInfo(url), getBestUrls(url)]);
    res.json({
      success: true,
      platform,
      data: {
        title:      info.title     || null,
        thumbnail:  info.thumbnail || null,
        duration:   info.duration  || null,
        uploader:   info.uploader  || info.channel || null,
        video_url:  best.video_url  || null,
        audio_url:  best.audio_url  || null,
        merged_url: best.merged_url || null,
        quality:    best.quality,
      },
    });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/audio?url=
// ─────────────────────────────────────────────────────────────
router.get("/audio", async (req, res) => {
  const url = requireUrl(req, res);
  if (!url) return;

  const platform = detectPlatform(url);
  console.log(`[AUDIO] ${platform} — ${url}`);

  try {
    const [info, best] = await Promise.all([getInfo(url), getBestUrls(url)]);
    const audio_url = best.audio_url || best.merged_url || null;

    if (!audio_url) {
      return res.status(404).json({ success: false, error: "No audio stream found for this URL" });
    }

    res.json({
      success: true,
      platform,
      data: {
        audio_url,
        title:     info.title     || null,
        thumbnail: info.thumbnail || null,
        duration:  info.duration  || null,
        uploader:  info.uploader  || info.channel || null,
      },
    });
  } catch (err) {
    errResponse(res, err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/vailstt?url=   ← Android-optimized endpoint
// ─────────────────────────────────────────────────────────────
router.get("/vailstt", async (req, res) => {
  const url = requireUrl(req, res);
  if (!url) return;

  const platform = detectPlatform(url);
  console.log(`[VAILSTT] ${platform} — ${url}`);

  try {
    const [info, downloads] = await Promise.all([
      getInfo(url),
      buildDownloadList(url),
    ]);

    res.json({
      success:   true,
      title:     info.title     || null,
      thumbnail: info.thumbnail || null,
      duration:  info.duration  || null,
      platform,
      uploader:  info.uploader  || info.channel || null,
      downloads,
    });
  } catch (err) {
    errResponse(res, err);
  }
});

module.exports = router;
