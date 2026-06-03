const router = require("express").Router();
const fetch  = require("node-fetch");

// ── Pinterest oEmbed ──────────────────────────────────────────
async function fetchOEmbed(url) {
  try {
    const res = await fetch(
      `https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 8000 }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return { thumb: json.thumbnail_url, title: json.title };
  } catch { }
  return null;
}

// ── Cobalt ────────────────────────────────────────────────────
async function fetchCobalt(url) {
  try {
    const res = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, downloadMode: "auto", filenameStyle: "basic" }),
      timeout: 12000,
    });
    const json = await res.json();
    const s = json.status;
    if (s === "tunnel" || s === "redirect") return { url: json.url };
    if (s === "picker") return { url: json.picker?.[0]?.url, all: json.picker?.map(p => p.url) };
  } catch { }
  return null;
}

// ── Pinterest page scrape ─────────────────────────────────────
async function fetchPinPage(url) {
  try {
    // Resolve short URLs (pin.it)
    let finalUrl = url;
    if (url.includes("pin.it")) {
      const r = await fetch(url, { redirect: "follow", timeout: 8000 });
      finalUrl = r.url;
    }

    const res = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept-Language": "id-ID,id;q=0.9",
      },
      timeout: 10000,
    });
    const html = await res.text();

    // Video
    const videoRe = /"video_url":"(https:[^"]+\.mp4[^"]*)"/;
    const vm = html.match(videoRe);
    if (vm) return { url: vm[1].replace(/\\/g, ""), ext: "mp4" };

    // Image (orig size)
    const imgRe = /"orig":\{"url":"(https:[^"]+)"/;
    const im = html.match(imgRe);
    if (im) return { url: im[1].replace(/\\/g, ""), ext: "jpg", isPhoto: true };
  } catch { }
  return null;
}

router.get("/", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  console.log(`[PIN] ${url}`);

  try {
    const pin = await fetchPinPage(url);
    if (pin?.url) return res.json({ ok: true, source: "pinterest-scrape", ...pin });
  } catch (e) { console.warn("[PIN] Page scrape:", e.message); }

  try {
    const cob = await fetchCobalt(url);
    if (cob?.url) return res.json({ ok: true, source: "cobalt", url: cob.url, ext: "mp4" });
  } catch (e) { console.warn("[PIN] Cobalt:", e.message); }

  res.status(502).json({ error: "Failed to get Pinterest media." });
});

module.exports = router;
