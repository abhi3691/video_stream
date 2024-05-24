const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const PORT = 3000;

const app = express();
app.use(express.static("public"));

// Ensure the 'uploads' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Save uploaded files to the 'uploads' directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Keep the original filename
  },
});
const upload = multer({ storage: storage });

// Route for uploading a video file
app.post("/upload", upload.single("video"), function (req, res) {
  res.send("Video uploaded successfully");
});

// Endpoint to fetch list of video URLs
app.get("/videos", function (req, res) {
  fs.readdir(uploadDir, function (err, files) {
    if (err) {
      console.error("Error reading directory:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    const videoUrls = files.map((file) => `/video/${file}`);
    res.json(videoUrls);
  });
});

// Route for streaming the uploaded video
app.get("/video/:filename", function (req, res) {
  const videoPath = path.join(uploadDir, req.params.filename);
  const videoSize = fs.statSync(videoPath).size;
  const CHUNK_SIZE = 10 ** 6;
  const range = req.headers.range;
  if (!range) {
    res.status(404).send("Requires Range header");
    return;
  }
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accepts-Range": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };
  res.writeHead(206, headers);
  const videoStream = fs.createReadStream(videoPath, { start, end });
  videoStream.pipe(res);
});

app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}!`);
});
