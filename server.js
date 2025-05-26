const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5151;

const PUBLIC_URL = "https://secureshareserver-production.up.railway.app";

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Enable CORS
app.use(cors());

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir, {
    setHeaders: (res, path) => {
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Type", "application/octet-stream");
    }
}));

// Log incoming requests (for debug)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Multer setup for handling uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `${PUBLIC_URL}/uploads/${req.file.filename}`;
    res.json({
        message: "File uploaded successfully",
        filename: req.file.filename,
        url: fileUrl
    });
});

// File listing endpoint
app.get("/files", (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Unable to list files" });
        }

        const fileInfos = files.map((filename) => ({
            name: filename,
            url: `http://${req.hostname}:${PORT}/uploads/${filename}`
        }));

        res.json(fileInfos);
    });
});

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});