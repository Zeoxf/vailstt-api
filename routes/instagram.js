const router = require("express").Router();
const fetch  = require("node-fetch");

// ── Fallback 1: SnapSave ──────────────────────────────────────
async function fetchSnapSave(url) {
  try {
    const res = await fetch("https://snapsave.app/action.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Linux; Android 12)",
        "Referer": "https://snapsave.app/",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({ url }),
      timeout: 12000,
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Parse HD video links
    const links = [];
    const re = /href="(https:\/\/[^"]+(?:video|media|cdninstagram)[^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) links.push(m[1]);
    if (links.length) return { url: links[0], all: links };
  } catch { }
  return null;
}

// ── Fallback 2: SaveInsta (alternative) ──────────────────────
async function fetchSaveInsta(url) {
  try {
    const encoded = encodeURIComponent(url);
    const res = await fetch(`https://www.saveinsta.app/api/ajaxSearch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.saveinsta.app/",
      },
      body: new URLSearchParams({ q: url, t: "media", lang: "id" }),
      timeout: 12000,
    });
    const json = await res.json();
    if (json.data) {
      // Parse download links from HTML data
      const re = /href="(https:\/\/[^"]+)"/g;
      let m;
      while ((m = re.exec(json.data)) !== null) {
        if (m[1].includes("cdninstagram") || m[1].includes("scontent")) {
          return { url: m[1] };
        }
      }
    }
  } catch { }
  return null;
}

// ── Fallback 3: Cobalt ────────────────────────────────────────
async function fetchCobalt(url, audioOnly) {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        url,
        downloadMode: audioOnly ? "audio" : "auto",
        filenameStyle: "basic",
      }),
      timeout: 12000,
    });
    const json = await res.json();
    const s = json.status;
    if (s === "tunnel" || s === "redirect") return { url: json.url };
    if (s === "picker" && json.picker?.length) {
      return { url: json.picker[0].url, all: json.picker.map(p => p.url) };
    }
  } catch { }
  return null;
}

// ── Fallback 4: Instagram oEmbed (thumbnail/caption only) ─────
async function fetchOEmbed(url) {
  try {
    const res = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&hidecaption=0`,
      { timeout: 8000 }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return { thumb: json.thumbnail_url, title: json.title, author: json.author_name };
  } catch { }
  return null;
}

// ── Main route ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  const audioOnly = type === "mp3";
  console.log(`[IG] ${url}`);

  // Try 1: Cobalt
  try {
    const cob = await fetchCobalt(url, audioOnly);
    if (cob?.url) {
      return res.json({ ok: true, source: "cobalt", url: cob.url, all: cob.all || [cob.url], ext: audioOnly ? "mp3" : "mp4" });
    }
  } catch (e) { console.warn("[IG] Cobalt:", e.message); }

  // Try 2: SnapSave
  try {
    const snap = await fetchSnapSave(url);
    if (snap?.url) {
      return res.json({ ok: true, source: "snapsave", url: snap.url, all: snap.all || [snap.url], ext: "mp4" });
    }
  } catch (e) { console.warn("[IG] SnapSave:", e.message); }

  // Try 3: SaveInsta
  try {
    const si = await fetchSaveInsta(url);
    if (si?.url) {
      return res.json({ ok: true, source: "saveinsta", url: si.url, ext: "mp4" });
    }
  } catch (e) { console.warn("[IG] SaveInsta:", e.message); }

  res.status(502).json({ error: "All Instagram sources failed. Account may be private." });
});

module.exports = router;
