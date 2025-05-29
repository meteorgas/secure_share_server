const express = require("express");
const cors = require("cors");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] → ${req.method} ${req.originalUrl}`);
    next();
});

app.get("/", (req, res) => {
    res.send("🚀 Signaling server alive!");
});

app.get("/healthz", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 5151;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = new Map();

// === HTTP PIN pairing ===

function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/generate-pin", (req, res) => {
    const pin = generatePIN();
    const peerId = uuidv4();
    sessions.set(pin, { peerId, candidates: [] });
    res.json({ pin, peerId });
});

app.post("/lookup-pin", (req, res) => {
    const { pin } = req.body;
    const session = sessions.get(pin);
    if (!session) return res.status(404).json({ error: "PIN not found" });
    res.json({ peerId: session.peerId });
});

// === WebSocket signaling ===

const peers = new Map();  // peerId → ws

wss.on("connection", (ws) => {
    let myPeerId = null;

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            console.error("Invalid JSON:", raw);
            return;
        }

        const { type, peerId, to, sdp, candidate, sdpMid, sdpMLineIndex } = msg;

        switch (type) {
            case "register":
                myPeerId = peerId;
                peers.set(peerId, ws);
                console.log(`Registered peer ${peerId}`);
                break;

            case "offer":
            case "answer":
            {
                const target = peers.get(to);
                if (target) {
                    target.send(JSON.stringify({
                        type,
                        from: myPeerId,
                        sdp
                    }));
                }
            }
                break;

            case "ice-candidate":
            {
                const target = peers.get(to);
                if (target) {
                    target.send(JSON.stringify({
                        type,
                        from: myPeerId,
                        candidate,
                        sdpMid,
                        sdpMLineIndex
                    }));
                }
            }
                break;

            default:
                console.warn("Unknown WS message type:", type);
        }
    });

    ws.on("close", () => {
        if (myPeerId) peers.delete(myPeerId);
    });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Signaling server listening on 0.0.0.0:${PORT}`);
});