const router = require("express").Router();
const fetch  = require("node-fetch");

// ── Fallback 1: getfvid.com API ───────────────────────────────
async function fetchGetFVid(url) {
  try {
    const res = await fetch("https://www.getfvid.com/downloader", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.getfvid.com/",
      },
      body: new URLSearchParams({ url }),
      timeout: 12000,
    });
    if (!res.ok) return null;
    const html = await res.text();

    // HD link
    const hdMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"[^>]*>.*?HD/s);
    if (hdMatch) return { url: hdMatch[1], quality: "hd", ext: "mp4" };

    // SD link
    const sdMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
    if (sdMatch) return { url: sdMatch[1], quality: "sd", ext: "mp4" };
  } catch { }
  return null;
}

// ── Fallback 2: Cobalt ────────────────────────────────────────
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

// ── Fallback 3: fbdown.net ────────────────────────────────────
async function fetchFbDown(url) {
  try {
    const res = await fetch("https://fbdown.net/download.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://fbdown.net/",
      },
      body: new URLSearchParams({ url }),
      timeout: 12000,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/href="(https:\/\/[^"]*fbcdn[^"]*\.mp4[^"]*)"/);
    if (m) return { url: m[1], ext: "mp4" };
  } catch { }
  return null;
}

router.get("/", async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  const audioOnly = type === "mp3";
  console.log(`[FB] ${url}`);

  try {
    const cob = await fetchCobalt(url, audioOnly);
    if (cob?.url) return res.json({ ok: true, source: "cobalt", url: cob.url, ext: audioOnly ? "mp3" : "mp4" });
  } catch (e) { console.warn("[FB] Cobalt:", e.message); }

  try {
    const gf = await fetchGetFVid(url);
    if (gf?.url) return res.json({ ok: true, source: "getfvid", ...gf });
  } catch (e) { console.warn("[FB] GetFVid:", e.message); }

  try {
    const fb = await fetchFbDown(url);
    if (fb?.url) return res.json({ ok: true, source: "fbdown", ...fb });
  } catch (e) { console.warn("[FB] FbDown:", e.message); }

  res.status(502).json({ error: "All Facebook sources failed." });
});

module.exports = router;
