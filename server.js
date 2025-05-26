const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5151;

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Enable CORS for all origins
app.use(cors());

// Serve static files from uploads folder
app.use("/uploads", express.static(uploadDir));

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// File upload route
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = `http://${req.hostname}:${PORT}/uploads/${req.file.filename}`;
    res.json({
        message: "File uploaded successfully",
        filename: req.file.filename,
        url: fileUrl
    });
});

// Start server
app.listen(PORT, '0.0.0.0',() => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});