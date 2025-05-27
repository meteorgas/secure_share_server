const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5151;

const PUBLIC_URL = "https://secureshareserver-production.up.railway.app";

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors());
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use("/uploads", express.static(uploadDir, {
    setHeaders: (res) => {
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Type", "application/octet-stream");
    }
}));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// File Upload Endpoint
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

// File Listing Endpoint
app.get("/files", (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Unable to list files" });
        }

        const fileInfos = files.map((filename) => ({
            name: filename,
            url: `${PUBLIC_URL}/uploads/${filename}`
        }));

        res.json(fileInfos);
    });
});

// ----------------------
// PIN Pairing Endpoints
// ----------------------

const activePins = {};
const PIN_EXPIRATION_MINUTES = 10;

function generatePin(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pin = "";
    for (let i = 0; i < length; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

// Register PIN
app.post("/register", (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
        return res.status(400).json({ error: "Missing deviceId" });
    }

    const pin = generatePin();
    activePins[pin] = {
        deviceId,
        createdAt: Date.now()
    };

    console.log(`🔐 Registered PIN ${pin} for device ${deviceId}`);
    res.json({ pin });
});

// Resolve PIN
app.get("/resolve/:pin", (req, res) => {
    const pin = req.params.pin.toUpperCase();
    const data = activePins[pin];

    if (!data) {
        return res.status(404).json({ error: "PIN not found or expired" });
    }

    const age = (Date.now() - data.createdAt) / (60 * 1000);
    if (age > PIN_EXPIRATION_MINUTES) {
        delete activePins[pin];
        return res.status(410).json({ error: "PIN expired" });
    }

    res.json({ deviceId: data.deviceId });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});