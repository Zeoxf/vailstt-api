const router = require("express").Router();
const fetch  = require("node-fetch");

// ── Fallback 1: fxtwitter/fixvx API (free, no auth) ──────────
async function fetchFxTwitter(url) {
  try {
    // Extract tweet ID
    const m = url.match(/status\/(\d+)/);
    if (!m) return null;
    const tweetId = m[1];

    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: { "User-Agent": "VailsTT/2.0" },
      timeout: 10000,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tweet = json.tweet;
    if (!tweet) return null;

    const media = tweet.media;
    if (!media) return { title: tweet.text, author: tweet.author?.name, thumb: null, url: null };

    // Videos
    if (media.videos?.length) {
      const best = media.videos[0].variants
        ?.filter(v => v.content_type === "video/mp4")
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url) return {
        url: best.url,
        thumb: media.videos[0].thumbnail_url,
        title: tweet.text,
        author: tweet.author?.name,
        ext: "mp4",
      };
    }

    // Photos
    if (media.photos?.length) {
      return {
        url: media.photos[0].url,
        all: media.photos.map(p => p.url),
        title: tweet.text,
        author: tweet.author?.name,
        ext: "jpg",
        isPhoto: true,
      };
    }
  } catch { }
  return null;
}

// ── Fallback 2: twitsave.com ──────────────────────────────────
async function fetchTwitSave(url) {
  try {
    const res = await fetch(`https://twitsave.com/info?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const re = /href="(https:\/\/video\.twimg\.com[^"]+\.mp4[^"]*)"/g;
    let m; const links = [];
    while ((m = re.exec(html)) !== null) links.push(m[1]);
    if (links.length) return { url: links[0], ext: "mp4" };
  } catch { }
  return null;
}

// ── Fallback 3: Cobalt ────────────────────────────────────────
async function fetchCobalt(url, audioOnly) {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, downloadMode: audioOnly ? "audio" : "auto", filenameStyle: "basic" }),
      timeout: 12000,
    });
    const json = await res.json();
    const s = json.status;
    if (s === "tunnel" || s === "redirect") return { url: json.url };
    if (s === "picker") return { url: json.picker?.[0]?.url };
  } catch { }
  return null;
}

// ── Main route ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  const audioOnly = type === "mp3";
  console.log(`[TW] ${url}`);

  // Try 1: fxtwitter (best, free, no rate limit)
  try {
    const fx = await fetchFxTwitter(url);
    if (fx?.url) return res.json({ ok: true, source: "fxtwitter", ...fx });
  } catch (e) { console.warn("[TW] fxtwitter:", e.message); }

  // Try 2: Cobalt
  try {
    const cob = await fetchCobalt(url, audioOnly);
    if (cob?.url) return res.json({ ok: true, source: "cobalt", url: cob.url, ext: audioOnly ? "mp3" : "mp4" });
  } catch (e) { console.warn("[TW] Cobalt:", e.message); }

  // Try 3: TwitSave
  try {
    const ts = await fetchTwitSave(url);
    if (ts?.url) return res.json({ ok: true, source: "twitsave", ...ts });
  } catch (e) { console.warn("[TW] TwitSave:", e.message); }

  res.status(502).json({ error: "All Twitter/X sources failed. Tweet may be from private account." });
});

module.exports = router;
