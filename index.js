const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.static("public"));

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Ensure the 'uploads' directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Ensure the 'hls' directory exists
const hlsDir = path.join(__dirname, "hls");
if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir);
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
  const videoPath = path.join(uploadDir, req.file.filename);
  const outputDir = path.join(hlsDir, path.parse(req.file.filename).name);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Check if the video has audio streams
  ffmpeg.ffprobe(videoPath, function (err, metadata) {
    if (err) {
      console.error("Error probing video:", err);
      res.status(500).send("Error probing video");
      return;
    }

    const hasAudio = metadata.streams.some(
      (stream) => stream.codec_type === "audio"
    );

    const ffmpegCommand = ffmpeg(videoPath)
      .output(`${outputDir}/index.m3u8`)
      .outputOptions([
        "-c:v copy", // Copy video stream
      ]);

    console.log("hasAudio", hasAudio);

    if (hasAudio) {
      // Copy audio stream only if it exists
      ffmpegCommand.outputOptions([
        "-c:a copy", // Copy audio stream
      ]);
    }

    // Convert the video to HLS format
    ffmpegCommand
      .outputOptions([
        "-start_number 0",
        "-hls_time 10",
        "-hls_list_size 0",
        "-f hls",
      ])
      .on("end", () => {
        console.log("Conversion to HLS completed.");
        res.send("Video uploaded and converted successfully");
      })
      .on("error", (err) => {
        console.error("Error converting video:", err);
        res.status(500).send("Error converting video");
      })
      .run();
  });
});

// Endpoint to fetch list of video URLs
app.get("/videos", function (req, res) {
  fs.readdir(hlsDir, function (err, files) {
    if (err) {
      console.error("Error reading directory:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    const videoUrls = files.map((file) => `/hls/${file}/index.m3u8`);
    res.json(videoUrls);
  });
});

// Serve the HLS files
app.use("/hls", express.static(hlsDir));

app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}!`);
});
