const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = 5151;
const PUBLIC_URL = "https://secureshareserver-production.up.railway.app";
const http = require("http");
const {v4: uuidv4} = require("uuid");
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const sessions = new Map(); // PIN -> { peerId, offer, answer, candidates: [] }

// In-memory PIN → deviceId store
const pinToDeviceMap = {};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

wss.on('connection', socket => {
    let peerId = null;

    socket.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'register') {
                peerId = data.peerId;
                peers.set(peerId, socket);
                console.log(`Peer registered: ${peerId}`);
            } else if (data.type === 'signal') {
                const { to, payload } = data;
                const targetSocket = peers.get(to);
                if (targetSocket) {
                    targetSocket.send(JSON.stringify({
                        type: 'signal',
                        from: peerId,
                        payload
                    }));
                }
            }
        } catch (e) {
            console.error("Failed to process WebSocket message", e);
        }
    });

    socket.on('close', () => {
        if (peerId) peers.delete(peerId);
    });
});

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
const upload = multer({storage});

// Log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({error: "No file uploaded"});

    const fileUrl = `${PUBLIC_URL}/uploads/${req.file.filename}`;
    res.json({message: "File uploaded successfully", filename: req.file.filename, url: fileUrl});
});

// Files list
app.get("/files", (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({error: "Unable to list files"});

        const fileInfos = files.map(name => ({
            name,
            url: `${PUBLIC_URL}/uploads/${name}`
        }));
        res.json(fileInfos);
    });
});

// Device registration
app.post("/register", (req, res) => {
    const {deviceId} = req.body;
    if (!deviceId) return res.status(400).json({error: "Missing deviceId"});

    console.log("✅ Registered device:", deviceId);
    res.json({message: "Registered successfully", deviceId});
});

function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// === API Endpoints ===

// 1. Generate PIN
app.post("/generate-pin", (req, res) => {
    const pin = generatePIN();
    const peerId = uuidv4();
    sessions.set(pin, {peerId, candidates: []});
    res.json({pin, peerId});
});

// 2. Lookup PIN
app.post("/lookup-pin", (req, res) => {
    const {pin} = req.body;
    const session = sessions.get(pin);
    if (session) {
        res.json({peerId: session.peerId});
    } else {
        res.status(404).json({error: "PIN not found"});
    }
});

// 3. Save Offer
app.post("/offer", (req, res) => {
    const {pin, offer} = req.body;
    const session = sessions.get(pin);
    if (session) {
        session.offer = offer;
        res.json({success: true});
    } else {
        res.status(404).json({error: "PIN not found"});
    }
});

// 4. Save Answer
app.post("/answer", (req, res) => {
    const {pin, answer} = req.body;
    const session = sessions.get(pin);
    if (session) {
        session.answer = answer;
        res.json({success: true});
    } else {
        res.status(404).json({error: "PIN not found"});
    }
});

// 5. Exchange ICE candidates
app.post("/candidate", (req, res) => {
    const {pin, candidate} = req.body;
    const session = sessions.get(pin);
    if (session) {
        session.candidates.push(candidate);
        res.json({success: true});
    } else {
        res.status(404).json({error: "PIN not found"});
    }
});

app.get("/candidates/:pin", (req, res) => {
    const pin = req.params.pin;
    const session = sessions.get(pin);
    if (session) {
        res.json({candidates: session.candidates});
    } else {
        res.status(404).json({error: "PIN not found"});
    }
});

app.get("/offer/:pin", (req, res) => {
    const session = sessions.get(req.params.pin);
    if (session?.offer) {
        res.json({offer: session.offer});
    } else {
        res.status(404).json({error: "Offer not found"});
    }
});

app.get("/answer/:pin", (req, res) => {
    const session = sessions.get(req.params.pin);
    if (session?.answer) {
        res.json({answer: session.answer});
    } else {
        res.status(404).json({error: "Answer not found"});
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Signaling server running at http://localhost:${PORT}`);
});