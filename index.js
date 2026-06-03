require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const morgan   = require("morgan");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

// ── Routes ────────────────────────────────────────────────────
app.use("/yt",        require("./routes/youtube"));
app.use("/ig",        require("./routes/instagram"));
app.use("/tw",        require("./routes/twitter"));
app.use("/fb",        require("./routes/facebook"));
app.use("/pin",       require("./routes/pinterest"));
app.use("/universal", require("./routes/universal"));

// ── Health check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    server: "VailsTT Downloader API",
    version: "2.0.0",
    endpoints: {
      youtube:   "/yt?url=&type=video|mp3",
      instagram: "/ig?url=",
      twitter:   "/tw?url=",
      facebook:  "/fb?url=",
      pinterest: "/pin?url=",
      universal: "/universal?url=",
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ VailsTT API running on port ${PORT}`));
