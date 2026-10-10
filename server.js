// server.js
// Tiny backend for PokerMind. It needs NO npm packages, only Node.js 18 or newer.
//
//   Browser (index.html)  --->  this server (/api/coach)  --->  Gemini API
//
// The Gemini key lives in .env on the server, so it never reaches the browser or GitHub.
//
// Run:   node server.js      then open   http://localhost:3001

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askCoach, CoachError, keyIsConfigured } from "./gemini.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY_BYTES = 50_000;

// Frontend files (index.html, script.js, styles, images) are sent to browsers automatically.
// Blocked: server-only code, hidden files like .env and .git, node_modules, and any other file type.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
// Server-only files that must NEVER be sent to a browser (they'd reveal how the key is used).
const SERVER_ONLY_FILES = new Set(["server.js", "gemini.js"]);

// Turns a URL path into a safe file path inside this folder, or null if it isn't allowed.
function resolvePublicFile(pathname) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (urlPath === "/") urlPath = "/index.html";
  if (urlPath.includes("\\") || urlPath.includes("\0")) return null;

  const fullPath = path.resolve(ROOT, "." + urlPath);
  const relative = path.relative(ROOT, fullPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null; // outside the project

  // Lowercase because Mac and Windows treat SERVER.JS and server.js as the same file
  const parts = relative.toLowerCase().split(path.sep);
  if (parts.some((p) => p.startsWith(".") || p === "node_modules")) return null; // .env, .git, ...
  if (parts.length === 1 && SERVER_ONLY_FILES.has(parts[0])) return null;
  if (!CONTENT_TYPES[path.extname(fullPath).toLowerCase()]) return null;
  return fullPath;
}

// ---------------------------------------------------------------------------
// Minimal .env loader (KEY=value per line, # starts a comment)
// ---------------------------------------------------------------------------
function loadDotEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return; // no .env file; that's OK, the startup warning will explain
  }
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, ""); // strip "  # comment" after unquoted values
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk); // past the limit: keep reading, stop storing
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) {
        return reject(new CoachError("bad_request", 413, "Request body is too large."));
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new CoachError("bad_request", 400, "Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
async function handle(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");

  // Health check: the page calls this on load to show the coach status.
  if (pathname === "/api/health") {
    if (req.method !== "GET") return sendError(res, 405, "method_not_allowed", "Use GET.");
    return sendJson(res, 200, { ok: true, geminiKeyConfigured: keyIsConfigured() });
  }

  // The AI coach.
  // body:    { situation, message, history }
  // success: { reply, model, analysis }
  // failure: { error: { code, message } }
  if (pathname === "/api/coach") {
    if (req.method !== "POST") return sendError(res, 405, "method_not_allowed", "Use POST.");
    try {
      const body = await readJsonBody(req);
      const result = await askCoach(body);
      return sendJson(res, 200, result);
    } catch (err) {
      const known = err instanceof CoachError;
      const status = known ? err.httpStatus : 500;
      const code = known ? err.code : "server_error";
      const message = known ? err.message : "Something went wrong on the server.";
      // Server log only. The API key is never part of these messages.
      console.error(`[coach] ${code}: ${message}${err?.detail ? ` (${err.detail})` : ""}`);
      if (!known) console.error(err);
      return sendError(res, status, code, message);
    }
  }

  if (pathname.startsWith("/api/")) {
    return sendError(res, 404, "not_found", "Unknown API route.");
  }

  // Frontend files (index.html, script.js, ...). See resolvePublicFile() for what is blocked.
  const file = resolvePublicFile(pathname);
  if (file && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const content = await fs.promises.readFile(file);
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()],
        "Cache-Control": "no-store",
      });
      return res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      // file doesn't exist (or is a folder): fall through to 404
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(pathname === "/" || pathname === "/index.html"
    ? "index.html not found. Put server.js in the same folder as index.html."
    : "Not found");
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("[server]", err);
    if (!res.headersSent) sendError(res, 500, "server_error", "Something went wrong on the server.");
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server, or set PORT=3002 in .env.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`PokerMind running at http://localhost:${PORT}`);
  if (!keyIsConfigured()) {
    console.warn("WARNING: GEMINI_API_KEY is not set. Copy .env.example to .env, add your key, and restart.");
  }
});