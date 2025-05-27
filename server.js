const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5151;
const PUBLIC_URL = "https://secureshareserver-production.up.railway.app";

// In-memory PIN → deviceId store
const pinToDeviceMap = {};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors());
app.use(express.json());

// Static file serving
app.use("/uploads", express.static(uploadDir, {
    setHeaders: (res, path) => {
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Type", "application/octet-stream");
    }
}));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// Log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileUrl = `${PUBLIC_URL}/uploads/${req.file.filename}`;
    res.json({ message: "File uploaded successfully", filename: req.file.filename, url: fileUrl });
});

// Files list
app.get("/files", (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Unable to list files" });

        const fileInfos = files.map(name => ({
            name,
            url: `${PUBLIC_URL}/uploads/${name}`
        }));
        res.json(fileInfos);
    });
});

// Device registration
app.post("/register", (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    console.log("✅ Registered device:", deviceId);
    res.json({ message: "Registered successfully", deviceId });
});

// Generate PIN
app.post("/generate-pin", (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    pinToDeviceMap[pin] = deviceId;

    console.log("📌 Generated PIN:", pin, "for device:", deviceId);
    res.json({ pin });
});

// Lookup PIN
app.post("/lookup-pin", (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "Missing pin" });

    const deviceId = pinToDeviceMap[pin];
    if (!deviceId) return res.status(404).json({ error: "PIN not found or expired" });

    console.log("🔍 Resolved PIN:", pin, "to device:", deviceId);
    res.json({ deviceId });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});