"use strict";

const express     = require("express");
const helmet      = require("helmet");
const cors        = require("cors");
const compression = require("compression");
const morgan      = require("morgan");
const rateLimit   = require("express-rate-limit");

const app = express();

// ── Security & perf middleware ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan("tiny"));

// ── Global rate limit ─────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Rate limit exceeded. Max 15 requests per minute." },
});

app.use("/api", globalLimiter);
app.use("/api/download", strictLimiter);
app.use("/api/vailstt",  strictLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use("/api", require("./routes/api"));

// ── Root info ─────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    name:    "VailsTT Universal Downloader API",
    version: "3.0.0",
    endpoints: {
      health:   "GET /api/health",
      info:     "GET /api/info?url=",
      formats:  "GET /api/formats?url=",
      download: "GET /api/download?url=",
      audio:    "GET /api/audio?url=",
      vailstt:  "GET /api/vailstt?url=",
    },
    supported_platforms: [
      "YouTube", "TikTok", "Instagram", "Facebook",
      "X/Twitter", "Vimeo", "Dailymotion", "Reddit",
      "Twitch", "and 1000+ more via yt-dlp",
    ],
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  VailsTT API v3.0.0 — port ${PORT}`);
  console.log(`🔗  http://localhost:${PORT}`);
});

module.exports = app;
