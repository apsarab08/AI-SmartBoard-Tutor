import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import cors from "cors";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("smartboard.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    googleId TEXT UNIQUE,
    profileImage TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    topic TEXT,
    content TEXT,
    script TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lessonId INTEGER,
    message TEXT,
    response TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lessonId) REFERENCES lessons(id)
  );
`);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "smartboard-secret-key";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API Routes ---

// Google Auth
app.post("/api/auth/google", async (req, res) => {
  const { idToken } = req.body;
  try {
    let payload;
    if (idToken === 'mock-google-token') {
      payload = {
        sub: 'mock-123',
        email: 'guest@example.com',
        name: 'Guest Student',
        picture: 'https://picsum.photos/seed/guest/100/100'
      };
    } else {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }
    
    if (!payload) throw new Error("Invalid token");

    const { sub: googleId, email, name, picture: profileImage } = payload;

    let user = db.prepare("SELECT * FROM users WHERE googleId = ?").get(googleId) as any;

    if (!user) {
      const info = db.prepare("INSERT INTO users (name, email, googleId, profileImage) VALUES (?, ?, ?, ?)").run(name, email, googleId, profileImage);
      user = { id: info.lastInsertRowid, name, email, googleId, profileImage };
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Get Profile
app.get("/api/user/profile", authenticateToken, (req: any, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json(user);
});

// Get Lessons
app.get("/api/lessons", authenticateToken, (req: any, res) => {
  const lessons = db.prepare("SELECT * FROM lessons WHERE userId = ? ORDER BY createdAt DESC").all(req.user.id);
  res.json(lessons);
});

// Create Lesson from Topic
app.post("/api/lesson/topic", authenticateToken, async (req: any, res) => {
  const { topic } = req.body;
  // We'll handle the actual AI generation on the frontend using @google/genai
  // but we store the initial record here.
  const info = db.prepare("INSERT INTO lessons (userId, topic) VALUES (?, ?)").run(req.user.id, topic);
  res.json({ id: info.lastInsertRowid, topic });
});

// Upload PDF and Extract Text
app.post("/api/lesson/upload", authenticateToken, upload.single("pdf"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdf(dataBuffer);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    const topic = req.body.topic || "PDF Lesson";
    const info = db.prepare("INSERT INTO lessons (userId, topic, content) VALUES (?, ?, ?)").run(req.user.id, topic, data.text);
    
    res.json({ id: info.lastInsertRowid, topic, content: data.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process PDF" });
  }
});

// Update Lesson with Script/Content
app.put("/api/lesson/:id", authenticateToken, (req: any, res) => {
  const { content, script } = req.body;
  db.prepare("UPDATE lessons SET content = ?, script = ? WHERE id = ? AND userId = ?")
    .run(content, script, req.params.id, req.user.id);
  res.json({ success: true });
});

// Get Single Lesson
app.get("/api/lesson/:id", authenticateToken, (req: any, res) => {
  const lesson = db.prepare("SELECT * FROM lessons WHERE id = ? AND userId = ?").get(req.params.id, req.user.id);
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });
  res.json(lesson);
});

// Chat Message
app.post("/api/chat/message", authenticateToken, (req: any, res) => {
  const { lessonId, message, response } = req.body;
  const info = db.prepare("INSERT INTO chat_messages (lessonId, message, response) VALUES (?, ?, ?)")
    .run(lessonId, message, response);
  res.json({ id: info.lastInsertRowid });
});

// Get Chat History
app.get("/api/chat/:lessonId", authenticateToken, (req: any, res) => {
  const messages = db.prepare("SELECT * FROM chat_messages WHERE lessonId = ? ORDER BY timestamp ASC").all(req.params.lessonId);
  res.json(messages);
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
