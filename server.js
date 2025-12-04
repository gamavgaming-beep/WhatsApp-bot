const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const qrcode = require("qrcode-terminal");

async function startBot() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // DB create
    const db = new sqlite3.Database("./bot.db");
    db.serialize(() => {
        db.run(
            `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, phone TEXT, direction TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
        );
    });

    // Baileys Auth
    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { qr, connection } = update;
        if (qr) qrcode.generate(qr, { small: true });
        console.log("Connection:", connection);
    });

    // RECEIVE MESSAGES
    sock.ev.on("messages.upsert", async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message) return;

            const from = m.key.remoteJid.replace("@s.whatsapp.net", "");
            const text = m.message.conversation || "";

            // Save incoming
            db.run(
                `INSERT INTO messages (phone, direction, content) VALUES (?, 'in', ?)`,
                [from, text]
            );

            // AUTO REPLY
            const reply = `🤖 Bot:\nஉங்கள் message வந்துருக்கு.\nMessage: ${text}`;
            await sock.sendMessage(m.key.remoteJid, { text: reply });

            // Save outgoing
            db.run(
                `INSERT INTO messages (phone, direction, content) VALUES (?, 'out', ?)`,
                [from, reply]
            );
        } catch (e) {
            console.log("Error:", e);
        }
    });

    // ADMIN API — list messages
    app.get("/api/messages", (req, res) => {
        db.all(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT 200",
            (err, rows) => {
                res.json(rows);
            }
        );
    });

    // ADMIN API — send message
    app.post("/api/send", async (req, res) => {
        const { phone, text } = req.body;
        const jid = phone + "@s.whatsapp.net";

        await sock.sendMessage(jid, { text });

        db.run(
            `INSERT INTO messages (phone, direction, content) VALUES (?, 'out', ?)`,
            [phone, text]
        );

        res.json({ status: "sent" });
    });

    // Serve admin panel static
    app.use("/", express.static("admin"));

    app.listen(3000, () =>
        console.log("Admin Panel Running: http://localhost:3000")
    );
}

startBot();