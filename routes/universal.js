const router = require("express").Router();
const fetch  = require("node-fetch");

async function tryCobalt(url, audioOnly) {
  const res = await fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ url, downloadMode: audioOnly ? "audio" : "auto", filenameStyle: "basic" }),
    timeout: 12000,
  });
  const json = await res.json();
  const s = json.status;
  if (s === "tunnel" || s === "redirect") return json.url;
  if (s === "picker") return json.picker?.[0]?.url;
  return null;
}

async function trySaveFrom(url) {
  const res = await fetch(`https://savefrom.net/api/convert?url=${encodeURIComponent(url)}&lang=id`, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://savefrom.net/" },
    timeout: 10000,
  });
  if (!res.ok) return null;
  const json = await res.json();
  const links = json.url || [];
  const best = links.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
  return best?.url || null;
}

router.get("/", async (req, res) => {
  const { url, type } = req.query;
  if (!url) return res.status(400).json({ error: "url parameter required" });

  const audioOnly = type === "mp3";
  console.log(`[UNIVERSAL] ${url}`);

  try {
    const u = await tryCobalt(url, audioOnly);
    if (u) return res.json({ ok: true, source: "cobalt", url: u });
  } catch { }

  try {
    const u = await trySaveFrom(url);
    if (u) return res.json({ ok: true, source: "savefrom", url: u });
  } catch { }

  res.status(502).json({ error: "Unable to process this URL." });
});

module.exports = router;
