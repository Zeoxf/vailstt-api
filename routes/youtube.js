const router = require("express").Router();
const ytdl   = require("@distube/ytdl-core");
const fetch  = require("node-fetch");

// ── Helper: clean YouTube URL ─────────────────────────────────
function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    // shorts → watch
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/shorts/")[1].split("/")[0];
      return `https://www.youtube.com/watch?v=${id}`;
    }
    return raw;
  } catch { return raw; }
}

// ── Fallback 1: invidious public instances ────────────────────
const INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://iv.melmac.space",
];

async function fetchInvidious(videoId, audioOnly) {
  for (const host of INVIDIOUS) {
    try {
      const res  = await fetch(`${host}/api/v1/videos/${videoId}`, { timeout: 8000 });
      if (!res.ok) continue;
      const data = await res.json();
      const fmts = data.adaptiveFormats || [];

      if (audioOnly) {
        const audio = fmts
          .filter(f => f.type?.includes("audio/mp4"))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        if (audio?.url) return { url: audio.url, title: data.title, thumb: data.videoThumbnails?.[0]?.url };
      } else {
        const vid = fmts
          .filter(f => f.type?.includes("video/mp4"))
          .sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0];
        if (vid?.url) return { url: vid.url, title: data.title, thumb: data.videoThumbnails?.[0]?.url };
      }
    } catch { continue; }
  }
  return null;
}

// ── Fallback 2: cobalt.tools ──────────────────────────────────
async function fetchCobalt(url, audioOnly) {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url,
        downloadMode: audioOnly ? "audio" : "auto",
        videoQuality: "1080",
        audioFormat: "mp3",
        filenameStyle: "basic",
      }),
      timeout: 12000,
    });
    const json = await res.json();
    const s = json.status;
    if (s === "tunnel" || s === "redirect") return { url: json.url };
    if (s === "picker" && json.picker?.length) return { url: json.picker[0].url };
  } catch { }
  return null;
}

// ── Fallback 3: y2mate-style ──────────────────────────────────
async function fetchY2Mate(url, audioOnly) {
  try {
    const analyze = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({ k_query: url, k_page: "home", hl: "id", q_auto: "0" }),
      timeout: 10000,
    });
    const aj = await analyze.json();
    const vid = aj.vid;
    if (!vid) return null;

    const ftype  = audioOnly ? "mp3" : "mp4";
    const fqual  = audioOnly ? "128" : "720";
    const conv = await fetch("https://www.y2mate.com/mates/convertV2/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({ type: "youtube", _id: vid, v_id: vid, ajax: "1", token: "", ftype, fquality: fqual }),
      timeout: 12000,
    });
    const cj = await conv.json();
    if (cj.dlink) return { url: cj.dlink };
  } catch { }
  return null;
}

// ── Main route ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  const audioOnly = type === "mp3";
  const cleanedUrl = cleanUrl(url);

  // Extract video ID
  let videoId;
  try {
    videoId = ytdl.getVideoID(cleanedUrl);
  } catch {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  console.log(`[YT] ${audioOnly ? "audio" : "video"} → ${videoId}`);

  // ── Try 1: ytdl-core ─────────────────────────────────────────
  try {
    const info    = await ytdl.getInfo(cleanedUrl);
    const title   = info.videoDetails.title;
    const thumb   = info.videoDetails.thumbnails?.slice(-1)[0]?.url || "";
    const author  = info.videoDetails.author?.name || "";
    const views   = info.videoDetails.viewCount || "0";
    const duration = info.videoDetails.lengthSeconds || "0";

    let fmt;
    if (audioOnly) {
      fmt = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
    } else {
      // prefer mp4 with video+audio
      fmt = ytdl.chooseFormat(info.formats, { quality: "highestvideo", filter: "videoandaudio" });
      if (!fmt) {
        // fallback: best mp4 video + best audio separately → return both for muxing
        const vFmt = ytdl.chooseFormat(info.formats, { quality: "highestvideo", filter: f => f.container === "mp4" && f.hasVideo });
        const aFmt = ytdl.chooseFormat(info.formats, { quality: "highestaudio",  filter: f => f.container === "mp4" && f.hasAudio });
        if (vFmt) {
          return res.json({
            ok: true, source: "ytdl-core",
            title, thumb, author, views, duration,
            url: vFmt.url, audioUrl: aFmt?.url || null,
            needsMux: true, ext: "mp4",
          });
        }
      }
    }

    if (fmt?.url) {
      return res.json({
        ok: true, source: "ytdl-core",
        title, thumb, author, views, duration,
        url: fmt.url,
        ext: audioOnly ? "mp3" : "mp4",
        needsMux: false,
      });
    }
  } catch (e) {
    console.warn("[YT] ytdl-core failed:", e.message);
  }

  // ── Try 2: Invidious ─────────────────────────────────────────
  try {
    const inv = await fetchInvidious(videoId, audioOnly);
    if (inv?.url) {
      return res.json({ ok: true, source: "invidious", ...inv, ext: audioOnly ? "mp3" : "mp4", needsMux: false });
    }
  } catch (e) {
    console.warn("[YT] Invidious failed:", e.message);
  }

  // ── Try 3: Cobalt ─────────────────────────────────────────────
  try {
    const cob = await fetchCobalt(cleanedUrl, audioOnly);
    if (cob?.url) {
      return res.json({ ok: true, source: "cobalt", url: cob.url, ext: audioOnly ? "mp3" : "mp4", needsMux: false });
    }
  } catch (e) {
    console.warn("[YT] Cobalt failed:", e.message);
  }

  // ── Try 4: Y2Mate ─────────────────────────────────────────────
  try {
    const y2 = await fetchY2Mate(cleanedUrl, audioOnly);
    if (y2?.url) {
      return res.json({ ok: true, source: "y2mate", url: y2.url, ext: audioOnly ? "mp3" : "mp4", needsMux: false });
    }
  } catch (e) {
    console.warn("[YT] Y2Mate failed:", e.message);
  }

  res.status(502).json({ error: "All YouTube sources failed. Video may be region-locked or private." });
});

module.exports = router;
