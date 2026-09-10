import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Storage path for student registry cache and master persistent database
const STUDENTS_CACHE_FILE = path.join(process.cwd(), "students_registry.json");
const DB_FILE = path.join(process.cwd(), "school_database.json");

const DEMO_PUPIL_IDS = new Set<string>([
  "st-105","st-110","st-n1-03","st-n1-04","st-n1-05","st-n1-06","st-n1-07","st-n1-08","st-n1-09","st-n1-10","st-n1-11","st-n1-12","st-n1-13",
  "st-111","st-112","st-n2-03","st-n2-04","st-n2-05","st-n2-06","st-n2-07","st-n2-08","st-n2-09","st-n2-10","st-n2-11","st-n2-12","st-n2-13",
  "st-106","st-113","st-kg1-03","st-kg1-04","st-kg1-05","st-kg1-06","st-kg1-07","st-kg1-08","st-kg1-09","st-kg1-10","st-kg1-11","st-kg1-12","st-kg1-13",
  "st-114","st-115","st-kg2-03","st-kg2-04","st-kg2-05","st-kg2-06","st-kg2-07","st-kg2-08","st-kg2-09","st-kg2-10","st-kg2-11","st-kg2-12","st-kg2-13",
  "st-101","st-102","st-p1-03","st-p1-04","st-p1-05","st-p1-06","st-p1-07","st-p1-08","st-p1-09","st-p1-10","st-p1-11","st-p1-12","st-p1-13","st-p1-14",
  "st-p2-01","st-p2-02","st-p2-03","st-p2-04","st-p2-05","st-p2-06","st-p2-07","st-p2-08","st-p2-09","st-p2-10","st-p2-11","st-p2-12","st-p2-13",
  "st-p3-01","st-p3-02","st-p3-03","st-p3-04","st-p3-05","st-p3-06","st-p3-07","st-p3-08","st-p3-09","st-p3-10","st-p3-11","st-p3-12","st-p3-13",
  "st-p4-01","st-p4-02","st-p4-03","st-p4-04","st-p4-05","st-p4-06","st-p4-07","st-p4-08","st-p4-09","st-p4-10","st-p4-11","st-p4-12","st-p4-13",
  "st-p5-01","st-p5-02","st-p5-03","st-p5-04","st-p5-05","st-p5-06","st-p5-07","st-p5-08","st-p5-09","st-p5-10","st-p5-11","st-p5-12","st-p5-13",
  "st-p6-01","st-p6-02","st-p6-03","st-p6-04","st-p6-05","st-p6-06","st-p6-07","st-p6-08","st-p6-09","st-p6-10","st-p6-11","st-p6-12","st-p6-13",
  "st-103","st-104","st-109","st-j1-04","st-j1-05","st-j1-06","st-j1-07","st-j1-08","st-j1-09","st-j1-10","st-j1-11","st-j1-12","st-j1-13",
  "st-107","st-108","st-j2-03","st-j2-04","st-j2-05","st-j2-06","st-j2-07","st-j2-08","st-j2-09","st-j2-10","st-j2-11","st-j2-12","st-j2-13",
  "st-j3-01","st-j3-02","st-j3-03","st-j3-04","st-j3-05","st-j3-06","st-j3-07","st-j3-08","st-j3-09","st-j3-10","st-j3-11","st-j3-12","st-j3-13"
]);

function isDemoStudent(s: any): boolean {
  if (!s) return false;
  if (s.id && DEMO_PUPIL_IDS.has(String(s.id))) return true;
  return false;
}

function isStudentDeletedOnServer(s: any, deletedIds?: string[]): boolean {
  if (!s || !s.id) return false;
  const db = dbCache || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) : null);
  const allDeleted = new Set([
    ...(db?.deletedStudentIds || []),
    ...(deletedIds || [])
  ].map(x => String(x).toLowerCase().trim()));
  if (allDeleted.size === 0) return false;

  return allDeleted.has(String(s.id).toLowerCase().trim());
}

function loadServerStudents(): any[] {
  try {
    const db = dbCache || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) : null);
    if (db && db.rosterCleared) {
      return [];
    }
    if (db && Array.isArray(db.students)) {
      return db.students.filter(s => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));
    }
    if (fs.existsSync(STUDENTS_CACHE_FILE)) {
      const data = fs.readFileSync(STUDENTS_CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.filter(s => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db?.deletedStudentIds));
    }
  } catch (err) {
    console.warn("[Server Students] Failed to read students cache:", err);
  }
  return [];
}

function saveServerStudents(students: any[]): boolean {
  try {
    const db = loadServerDatabase();
    const clean = (students || []).filter(s => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));
    fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(clean, null, 2), "utf-8");
    // Also update unified server database
    db.students = clean;
    if (clean.length === 0) {
      db.rosterCleared = true;
      db.rosterClearedAt = new Date().toISOString();
    } else {
      db.rosterCleared = false;
    }
    saveServerDatabase(db, "students", clean);
    return true;
  } catch (err) {
    console.warn("[Server Students] Failed to write students cache:", err);
    return false;
  }
}

// Master Server Database structure
interface ServerDatabase {
  version: number;
  lastUpdated: string;
  config: any;
  teachers: any[];
  students: any[];
  grades: any[];
  attendance: any[];
  dailyAttendance: any[];
  bills: any[];
  feePayments: any[];
  feeStructures: any[];
  dailyCollections: any[];
  inventory: any[];
  bookStock: any[];
  bookSales: any[];
  jhsMockExams: any[];
  deletedStudentIds: string[];
  deletedTeacherIds: string[];
  deletedBookStockIds?: string[];
  deletedBookSaleIds?: string[];
  rosterCleared?: boolean;
  rosterClearedAt?: string;
}

let dbCache: ServerDatabase | null = null;
const sseClients = new Set<express.Response>();

function broadcastSse(type: string, entity: string, payload?: any) {
  const currentDb = dbCache || loadServerDatabase();
  const eventData = JSON.stringify({
    type,
    entity,
    version: currentDb.version,
    payload,
    timestamp: currentDb.lastUpdated
  });

  for (const client of sseClients) {
    try {
      client.write(`event: sync\ndata: ${eventData}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

const DEFAULT_SERVER_TEACHERS = [
  { id: "tch-01", name: "Kojo Mensah (Nursery 1)", email: "nursery@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 1"], subjects: ["sub-n-lit", "sub-n-num"] },
  { id: "tch-n2", name: "Esi Agyeman (Nursery 2)", email: "nursery2@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 2"], subjects: ["sub-n-cr", "sub-n-pho"] },
  { id: "tch-k1", name: "Akosua Boakye (KG 1)", email: "kg1@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 1"], subjects: ["sub-k-lit", "sub-k-num"] },
  { id: "tch-k2", name: "Kofi Osei (KG 2)", email: "kg2@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 2"], subjects: ["sub-k-owop", "sub-k-ca"] },
  { id: "tch-02", name: "Ama Serwaa (Primary 1)", email: "primary@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 1"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p2", name: "Kwame Nkrumah (Primary 2)", email: "primary2@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 2"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p3", name: "Abena Darko (Primary 3)", email: "primary3@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 3"], subjects: ["sub-p-math", "sub-p-sci"] },
  { id: "tch-p4", name: "Yaa Asantewaa (Primary 4)", email: "primary4@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 4"], subjects: ["sub-p-eng", "sub-p-soc"] },
  { id: "tch-p5", name: "Kofi Addo (Primary 5)", email: "primary5@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 5"], subjects: ["sub-p-math", "sub-p-rme"] },
  { id: "tch-p6", name: "Adwoa Mansa (Primary 6)", email: "primary6@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 6"], subjects: ["sub-p-eng", "sub-p-ict"] },
  { id: "tch-03", name: "Kwesi Appiah", email: "jhs@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-math", "sub-j-ca"] },
  { id: "tch-04", name: "Abena Gyamfi", email: "jhs2@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-eng", "sub-j-sci"] },
  { id: "tch-05", name: "Yaw Asamoah", email: "jhs3@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-soc", "sub-j-rme"] }
];

function getDefaultDatabase(): ServerDatabase {
  const existingStudents = loadServerStudents();
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    config: null,
    teachers: DEFAULT_SERVER_TEACHERS,
    students: existingStudents,
    grades: [],
    attendance: [],
    dailyAttendance: [],
    bills: [],
    feePayments: [],
    feeStructures: [],
    dailyCollections: [],
    inventory: [],
    bookStock: [],
    bookSales: [],
    jhsMockExams: [],
    deletedStudentIds: [],
    deletedTeacherIds: [],
    deletedBookStockIds: [],
    deletedBookSaleIds: []
  };
}

function loadServerDatabase(): ServerDatabase {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        if (!parsed.rosterCleared && (!Array.isArray(parsed.students) || parsed.students.length === 0)) {
          const fallbackStudents = loadServerStudents();
          if (fallbackStudents.length > 0) {
            parsed.students = fallbackStudents;
          }
        }
        dbCache = {
          ...getDefaultDatabase(),
          ...parsed,
          students: parsed.rosterCleared ? [] : (parsed.students || []).filter((s: any) => !isDemoStudent(s))
        };
        return dbCache!;
      }
    }
  } catch (err) {
    console.warn("[Server DB] Failed reading school_database.json:", err);
  }

  dbCache = getDefaultDatabase();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), "utf-8");
  } catch (e) {}
  return dbCache;
}

function saveServerDatabase(db: ServerDatabase, broadcastEntity?: string, payload?: any): boolean {
  try {
    db.version = (db.version || 0) + 1;
    db.lastUpdated = new Date().toISOString();
    db.students = (db.students || []).filter(s => !isDemoStudent(s));
    dbCache = db;

    // Atomic write to disk
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmpFile, DB_FILE);

    // Also synchronize legacy students_registry.json
    try {
      fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(db.students, null, 2), "utf-8");
    } catch (e) {}

    // Broadcast update via SSE to all connected browsers, tabs & devices
    if (broadcastEntity) {
      broadcastSse("UPDATE", broadcastEntity, payload !== undefined ? payload : db[broadcastEntity as keyof ServerDatabase]);
    } else {
      broadcastSse("SYNC_ALL", "all", payload !== undefined ? payload : db);
    }
    return true;
  } catch (err) {
    console.error("[Server DB] Failed saving database:", err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large sync payloads (up to 50MB) for full school rosters, photos, grades & backups
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Handle PayloadTooLargeError or malformed JSON payloads gracefully
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === "entity.too.large" || err.status === 413 || err.name === "PayloadTooLargeError")) {
      console.warn(`[Payload Warning] Request entity too large on ${req.method} ${req.path}`);
      return res.status(413).json({
        status: "error",
        error: "PayloadTooLargeError",
        message: "Request entity is too large. Please reduce payload size or image resolution."
      });
    }
    if (err && err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ status: "error", message: "Invalid JSON format." });
    }
    next(err);
  });

  // 0. CDN & Edge Proxy Anti-Caching Middleware for dynamic API routes
  // Guarantees that Google Cloud CDN, Cloudflare, proxies, and mobile browsers NEVER serve stale responses for dynamic state
  app.use("/api", (req, res, next) => {
    // Exclude static or proxy CDN endpoints from no-store headers if they explicitly opt into caching
    if (req.path === "/cdn/health" || req.path === "/cdn/status") {
      res.setHeader("Cache-Control", "public, max-age=60");
      return next();
    }
    if (req.path.startsWith("/cdn/proxy")) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("CDN-Cache-Control", "public, max-age=86400");
      return next();
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    next();
  });

  // Dedicated CDN Storage Directory
  const cdnStorageDir = path.join(process.cwd(), "public", "cdn");
  if (!fs.existsSync(cdnStorageDir)) {
    try {
      fs.mkdirSync(cdnStorageDir, { recursive: true });
    } catch (e) {}
  }

  // Ensure common subfolders exist for CDN organization
  ["student-photos", "teacher-photos", "logos", "assets"].forEach(folder => {
    const fPath = path.join(cdnStorageDir, folder);
    if (!fs.existsSync(fPath)) {
      try { fs.mkdirSync(fPath, { recursive: true }); } catch (e) {}
    }
  });

  // Mount /cdn endpoint for serving edge-cached CDN assets with long-term immutable caching
  app.use("/cdn", express.static(cdnStorageDir, {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("CDN-Cache-Control", "public, max-age=31536000");
      res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=31536000");
    }
  }));

  // GET /api/cdn/health & /api/cdn/status - Verify CDN and edge operational status
  app.get(["/api/cdn/health", "/api/cdn/status"], (req, res) => {
    return res.status(200).json({
      status: "ok",
      cdn: "operational",
      edgeSync: "active",
      storage: "ready",
      antiStaleProtection: true,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/cdn/upload - Upload assets directly to persistent CDN storage
  app.post("/api/cdn/upload", (req, res) => {
    try {
      const { fileData, fileName, folder = "assets", contentType = "image/jpeg" } = req.body || {};
      if (!fileData || typeof fileData !== "string") {
        return res.status(400).json({ status: "error", message: "fileData (base64 string or data URL) is required." });
      }

      // Safe folder name (prevent directory traversal)
      const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, "_") || "assets";
      const targetDir = path.join(cdnStorageDir, safeFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Extract raw base64 and determine extension
      let base64String = fileData;
      let ext = "jpg";
      if (fileData.startsWith("data:")) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          base64String = matches[2];
          if (mime.includes("png")) ext = "png";
          else if (mime.includes("webp")) ext = "webp";
          else if (mime.includes("svg")) ext = "svg";
          else if (mime.includes("pdf")) ext = "pdf";
          else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        }
      }

      const buffer = Buffer.from(base64String, "base64");
      const safeName = (fileName ? String(fileName).replace(/[^a-zA-Z0-9_.-]/g, "_") : `asset_${Date.now()}.${ext}`).replace(/\.[^.]+$/, `.${ext}`);
      const filePath = path.join(targetDir, safeName);

      fs.writeFileSync(filePath, buffer);

      const publicPath = `/cdn/${safeFolder}/${safeName}`;
      console.log(`[CDN Storage] Asset written to ${publicPath} (${buffer.length} bytes)`);

      return res.status(200).json({
        status: "success",
        url: publicPath,
        cdnUrl: publicPath,
        size: buffer.length,
        contentType,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[CDN Storage] Upload error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to save file to CDN storage." });
    }
  });

  // GET /api/cdn/proxy?url=<url> - CORS-safe CDN Image Proxy
  app.get("/api/cdn/proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
        return res.status(400).send("Valid http/https url query parameter required.");
      }

      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch upstream asset: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("CDN-Cache-Control", "public, max-age=86400");

      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[CDN Proxy] Error proxying asset:", err);
      return res.status(500).send("Error proxying asset.");
    }
  });

  // API Route: Check Arkesel API Balance
  app.get("/api/sms/balance", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        (req.query.apiKey as string) ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required." });
      }

      const v2BalanceUrl = "https://sms.arkesel.com/api/v2/clients/balance";
      console.log(`[Arkesel Balance Check] Request URL: ${v2BalanceUrl} | Method: GET | Headers: { api-key: '${apiKey.substring(0, 4)}...' }`);

      // 1. Try Arkesel v2 API balance endpoint first
      let response = await fetch(v2BalanceUrl, {
        method: "GET",
        headers: {
          "api-key": apiKey.trim(),
          "Accept": "application/json"
        }
      }).catch(() => null);

      if (response) {
        console.log(`[Arkesel Balance Check] v2 Response Status: ${response.status}`);
        if (response.status === 404) {
          console.warn(`[Arkesel Balance Check] 404 Not Found at ${v2BalanceUrl}`);
        }
      }

      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          return res.status(200).json(data);
        }
      }

      // 2. Try Arkesel v1 API balance endpoint fallback
      const v1Url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey.trim())}`;
      console.log(`[Arkesel Balance Check] Fallback v1 Request URL: https://sms.arkesel.com/sms/api?action=check-balance&api_key=*** | Method: GET`);

      const v1Response = await fetch(v1Url, { method: "GET" }).catch(() => null);

      if (v1Response) {
        console.log(`[Arkesel Balance Check] v1 Response Status: ${v1Response.status}`);
      }

      if (v1Response && v1Response.ok) {
        const v1Data = await v1Response.json().catch(() => null);
        if (v1Data) {
          return res.status(200).json({
            status: "success",
            data: { balance: v1Data.balance ?? v1Data.sms_balance ?? v1Data.main_balance ?? "Active" },
            raw: v1Data
          });
        }
      }

      // If both return non-200, respond with helpful diagnostic
      const status = response ? response.status : (v1Response ? v1Response.status : 502);
      if (status === 404) {
        return res.status(404).json({
          status: "error",
          message: "Arkesel Gateway HTTP 404: The requested endpoint URL was not found on sms.arkesel.com. Please verify your Arkesel account status and v2 API key."
        });
      }

      return res.status(status).json({
        status: "error",
        message: "Unable to connect to Arkesel SMS Gateway. Please double-check your Arkesel API key."
      });
    } catch (err: any) {
      console.error("Arkesel balance proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to connect to Arkesel gateway" });
    }
  });

  // API Route: Run Arkesel Endpoint Diagnostics
  app.get("/api/sms/diagnose", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        (req.query.apiKey as string) ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      const v2SendUrl = "https://sms.arkesel.com/api/v2/sms/send";
      const v2BalanceUrl = "https://sms.arkesel.com/api/v2/clients/balance";

      console.log(`[Arkesel Diagnostic] Testing Base URL: https://sms.arkesel.com`);
      console.log(`[Arkesel Diagnostic] Testing Endpoint 1: ${v2SendUrl} [POST]`);
      console.log(`[Arkesel Diagnostic] Testing Endpoint 2: ${v2BalanceUrl} [GET]`);

      const diagHeaders = {
        "api-key": apiKey.trim() || "test_key",
        "Accept": "application/json"
      };

      const balancePing = await fetch(v2BalanceUrl, { method: "GET", headers: diagHeaders }).catch(() => null);

      return res.status(200).json({
        status: "success",
        diagnostics: {
          baseUrl: "https://sms.arkesel.com",
          v2SendEndpoint: {
            url: v2SendUrl,
            method: "POST",
            expectedHeaders: ["Content-Type: application/json", "api-key: <YOUR_ARKESEL_KEY>"],
            expectedBody: { sender: "STRING", message: "STRING", recipients: ["ARRAY_OF_STRINGS"] }
          },
          v2BalanceEndpoint: {
            url: v2BalanceUrl,
            method: "GET",
            status: balancePing ? balancePing.status : "CONNECTION_FAILED",
            ok: balancePing ? balancePing.ok : false
          },
          apiKeyProvided: Boolean(apiKey)
        }
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err?.message || "Diagnostic failed" });
    }
  });

  // API Route: Send Bulk SMS via Arkesel Gateway (v2 + v1 Fallback)
  app.post("/api/sms/send", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        req.body?.apiKey ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required. Please set your API key in Settings or Bulk SMS view." });
      }

      const { sender, message, recipients } = req.body || {};

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ status: "error", message: "Recipients list is empty or required." });
      }

      const cleanSender = (sender || "EASTFIELD").trim();
      const cleanMessage = (message || "").trim();
      const cleanRecipients = recipients.map((r: string) => {
        let cleaned = String(r).replace(/[^0-9]/g, "");
        if (cleaned.startsWith("0") && cleaned.length === 10) {
          cleaned = "233" + cleaned.substring(1);
        } else if (!cleaned.startsWith("233") && cleaned.length === 9) {
          cleaned = "233" + cleaned;
        }
        return cleaned;
      }).filter((r: string) => r.length >= 9);

      if (cleanRecipients.length === 0) {
        return res.status(400).json({ status: "error", message: "No valid recipient phone numbers provided." });
      }

      const v2SendUrl = "https://sms.arkesel.com/api/v2/sms/send";
      const maskedKey = apiKey.length > 6 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 2)}` : '***';

      console.log(`[Arkesel SMS Dispatch] Executing HTTP Request`);
      console.log(`[Arkesel SMS Dispatch] Target Endpoint URL: ${v2SendUrl}`);
      console.log(`[Arkesel SMS Dispatch] HTTP Method: POST`);
      console.log(`[Arkesel SMS Dispatch] Request Headers:`, { "Content-Type": "application/json", "api-key": maskedKey, "Accept": "application/json" });
      console.log(`[Arkesel SMS Dispatch] Request Payload:`, { sender: cleanSender, message: `${cleanMessage.substring(0, 30)}...`, recipientsCount: cleanRecipients.length });

      // 1. Primary: Try Arkesel v2 API POST endpoint
      let v2Response = await fetch(v2SendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey.trim(),
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: cleanSender,
          message: cleanMessage,
          recipients: cleanRecipients
        })
      }).catch(() => null);

      if (v2Response) {
        console.log(`[Arkesel SMS Dispatch] Gateway HTTP Response Code: ${v2Response.status}`);
      }

      if (v2Response && v2Response.ok) {
        const v2Data = await v2Response.json().catch(() => null);
        if (v2Data && (v2Data.status === "success" || v2Data.code === "100" || v2Data.code === 100 || v2Data.status === 200)) {
          return res.status(200).json(v2Data);
        }
      }

      // Check if v2 returned 404 explicitly
      if (v2Response && v2Response.status === 404) {
        console.warn(`[Arkesel SMS Dispatch] 404 Not Found at '${v2SendUrl}'`);
      }

      // 2. Secondary Fallback: Try Arkesel v1 API GET endpoint
      const phoneListStr = cleanRecipients.join(",");
      const v1Url = new URL("https://sms.arkesel.com/sms/api");
      v1Url.searchParams.append("action", "send-sms");
      v1Url.searchParams.append("api_key", apiKey.trim());
      v1Url.searchParams.append("to", phoneListStr);
      v1Url.searchParams.append("from", cleanSender);
      v1Url.searchParams.append("sms", cleanMessage);

      console.log(`[Arkesel SMS Dispatch] Trying Fallback v1 Endpoint URL: https://sms.arkesel.com/sms/api?action=send-sms&api_key=***&from=${cleanSender}&to=${cleanRecipients.length}_recipients`);

      const v1Response = await fetch(v1Url.toString(), { method: "GET" }).catch(() => null);

      if (v1Response) {
        console.log(`[Arkesel SMS Dispatch] Fallback v1 HTTP Response Code: ${v1Response.status}`);
      }

      if (v1Response && v1Response.ok) {
        const v1Data = await v1Response.json().catch(() => null);
        if (v1Data && (v1Data.code === "100" || v1Data.code === 100 || v1Data.status === "success" || v1Data.message?.toLowerCase().includes("success"))) {
          return res.status(200).json({
            status: "success",
            message: v1Data.message || "SMS dispatched successfully via Arkesel v1 Gateway",
            data: v1Data
          });
        } else if (v1Data && v1Data.message) {
          return res.status(400).json({
            status: "error",
            message: `Arkesel Gateway Notice: ${v1Data.message}`
          });
        }
      }

      // Read error body from v2 response if available
      const v2ErrData = v2Response ? await v2Response.json().catch(() => null) : null;
      const gatewayMsg = v2ErrData?.message || v2ErrData?.error || v2ErrData?.msg;

      if (gatewayMsg) {
        return res.status(400).json({
          status: "error",
          message: `Arkesel API Error: ${gatewayMsg}`
        });
      }

      // Handle HTTP 404 explicitly with full diagnostic explanation
      if (v2Response && v2Response.status === 404) {
        return res.status(404).json({
          status: "error",
          message: `HTTP 404 Endpoint Not Found: The Arkesel API URL '${v2SendUrl}' returned 404. Endpoint structure verified against Arkesel v2 specs (POST https://sms.arkesel.com/api/v2/sms/send with 'api-key' header). Please check if your Arkesel account is active and v2 API key permissions are enabled.`
        });
      }

      return res.status(400).json({
        status: "error",
        message: "Arkesel Gateway Error. Please verify that your API Key is valid and your Sender ID is registered in your Arkesel dashboard."
      });
    } catch (err: any) {
      console.error("Arkesel SMS proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to dispatch Arkesel SMS" });
    }
  });

  // ==========================================
  // GLOBAL INSTANT STUDENT SYNC & CDN APIS
  // ==========================================

  // GET /api/students: Fetch global list of admitted students with strict anti-caching headers
  app.get("/api/students", (req, res) => {
    // Ensure CDNs, proxies, Cloudflare, and browser caches never serve stale pupil rosters
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const students = loadServerStudents();
    const db = loadServerDatabase();
    return res.status(200).json({
      status: "success",
      students,
      count: students.length,
      version: db.version,
      deletedStudentIds: db.deletedStudentIds || [],
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/admit: Instantly admit or update a single pupil globally with CDN synchronization
  app.post("/api/students/admit", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const student = req.body?.student;
    if (!student || (!student.id && !student.name)) {
      return res.status(400).json({ status: "error", message: "Invalid student payload" });
    }

    const db = loadServerDatabase();
    // If roster was cleared, start fresh with just this student
    const currentStudents = db.rosterCleared ? [] : loadServerStudents();
    const cleanId = String(student.id || `st-${Date.now()}`);
    const cleanRoll = String(student.rollNumber || "").trim();

    // If this pupil was previously tombstoned, remove from deleted list
    if (Array.isArray(db.deletedStudentIds)) {
      const lowerId = cleanId.toLowerCase();
      const lowerRoll = cleanRoll.toLowerCase();
      const lowerName = String(student.name || '').trim().toLowerCase();
      db.deletedStudentIds = db.deletedStudentIds.filter(id => {
        const item = String(id).toLowerCase().trim();
        if (item === lowerId) return false;
        if (lowerRoll && item === lowerRoll) return false;
        if (lowerName && item === lowerName) return false;
        return true;
      });
    }

    // Check if student already exists by unique ID
    const existingIndex = currentStudents.findIndex(s => s.id === cleanId);
    let finalRoll = cleanRoll;

    // If new student admission collides with a different existing pupil's roll number, disambiguate
    if (existingIndex < 0 && cleanRoll) {
      const rollCollision = currentStudents.some(
        s => s.id !== cleanId && s.rollNumber && s.rollNumber.trim().toLowerCase() === cleanRoll.toLowerCase()
      );
      if (rollCollision) {
        finalRoll = `${cleanRoll}-${cleanId.slice(-4)}`;
      }
    }

    const normalizedStudent = {
      ...student,
      id: cleanId,
      rollNumber: finalRoll,
      updated_at: new Date().toISOString()
    };

    let updatedList: any[];
    if (existingIndex >= 0) {
      updatedList = currentStudents.map((s, idx) => idx === existingIndex ? normalizedStudent : s);
    } else {
      updatedList = [...currentStudents, normalizedStudent];
    }

    db.rosterCleared = false;
    saveServerStudents(updatedList);
    // Broadcast specific ADMIT event in addition to general update
    broadcastSse("ADMIT", "students", { action: "ADMIT", student: normalizedStudent, count: updatedList.length });
    console.log(`[Global Student Sync & CDN] Pupil '${normalizedStudent.name}' admitted / updated. Total pupils: ${updatedList.length}`);

    return res.status(200).json({
      status: "success",
      student: normalizedStudent,
      count: updatedList.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/clear: Instantly wipe student roster from global server cache and CDN
  app.post("/api/students/clear", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    saveServerStudents([]);
    console.log(`[Global Student Sync & CDN] Student roster cleared to 0 on server.`);
    return res.status(200).json({
      status: "success",
      count: 0,
      timestamp: new Date().toISOString()
    });
  });

  // DELETE /api/students: Clear all students
  app.delete("/api/students", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    saveServerStudents([]);
    console.log(`[Global Student Sync & CDN] Student roster cleared to 0 on server via DELETE.`);
    return res.status(200).json({
      status: "success",
      count: 0,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students: Bulk sync entire student roster with CDN
  app.post("/api/students", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const students = req.body?.students;
    if (!Array.isArray(students)) {
      return res.status(400).json({ status: "error", message: "Expected students array" });
    }

    if (students.length === 0) {
      const db = loadServerDatabase();
      if (db.students && db.students.length > 0) {
        console.warn(`[Server Students Sync Guard] Blocked empty students payload from overwriting ${db.students.length} existing server students.`);
        return res.status(200).json({
          status: "ignored",
          count: db.students.length,
          message: "Empty payload ignored to preserve existing recorded students",
          timestamp: new Date().toISOString()
        });
      }
      saveServerStudents([]);
      return res.status(200).json({
        status: "success",
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Authoritatively save the active students without re-merging previous cached students
    saveServerStudents(students);
    const db = loadServerDatabase();

    return res.status(200).json({
      status: "success",
      count: db.students.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // DELETE /api/students/:id: Delete pupil from global server store & invalidate CDN cache
  app.delete("/api/students/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const targetId = decodeURIComponent(req.params.id);
    const { rollNumber, studentName } = req.body || {};

    const db = loadServerDatabase();
    const toTombstone = [targetId, rollNumber, studentName].filter(Boolean) as string[];
    const currentDeleted = new Set((db.deletedStudentIds || []).map(x => String(x).toLowerCase().trim()));
    toTombstone.forEach(item => {
      const trimmed = String(item).toLowerCase().trim();
      if (trimmed) currentDeleted.add(trimmed);
      const cleanAlphanum = trimmed.replace(/[^a-z0-9]/g, '');
      if (cleanAlphanum) currentDeleted.add(cleanAlphanum);
    });
    db.deletedStudentIds = Array.from(currentDeleted);

    const isMatch = (s: any) => {
      if (s.id && (s.id === targetId || String(s.id).toLowerCase().trim() === targetId.toLowerCase().trim())) return true;
      if (rollNumber && s.rollNumber && String(s.rollNumber).toLowerCase().trim() === String(rollNumber).toLowerCase().trim()) return true;
      if (studentName && s.name && String(s.name).toLowerCase().trim() === String(studentName).toLowerCase().trim()) return true;
      return false;
    };

    const currentStudents = loadServerStudents();
    const updated = currentStudents.filter(s => !isMatch(s));

    // Also clean up grades, attendance, bills, mock exams for deleted student
    const keysToRemove = new Set(toTombstone.map(x => String(x).toLowerCase().trim()));
    if (Array.isArray(db.grades)) {
      db.grades = db.grades.filter(g => !keysToRemove.has(String(g.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.attendance)) {
      db.attendance = db.attendance.filter(a => !keysToRemove.has(String(a.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.bills)) {
      db.bills = db.bills.filter(b => !keysToRemove.has(String(b.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.dailyAttendance)) {
      db.dailyAttendance = db.dailyAttendance.filter(r => !keysToRemove.has(String(r.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.jhsMockExams)) {
      db.jhsMockExams = db.jhsMockExams.filter(m => !keysToRemove.has(String(m.studentId).toLowerCase().trim()));
    }

    saveServerStudents(updated);
    // Broadcast specific DELETE event across SSE
    broadcastSse("DELETE", "students", { action: "DELETE", id: targetId, rollNumber, studentName, remainingCount: updated.length });
    console.log(`[Global Student Sync & CDN] Student ID '${targetId}' permanently deleted. Remaining pupils: ${updated.length}`);

    return res.status(200).json({
      status: "success",
      count: updated.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================
  // REAL-TIME CROSS-DEVICE SYNC & SSE STREAM
  // ==========================================

  // GET /api/sync/stream: Real-time Server-Sent Events stream for cross-device updates
  app.get("/api/sync/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Flush initial connection packet
    const db = loadServerDatabase();
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", version: db.version, timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);
    console.log(`[Global Sync SSE] Client connected. Total active streams: ${sseClients.size}`);

    req.on("close", () => {
      sseClients.delete(res);
      console.log(`[Global Sync SSE] Client disconnected. Remaining streams: ${sseClients.size}`);
    });
  });

  // Keep-alive heartbeat to prevent CDN, GCP Cloud Run, and mobile proxy timeouts
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(`: ping\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }, 20000);

  // GET /api/sync/version: Fast, lightweight version check
  app.get("/api/sync/version", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated,
      counts: {
        students: db.students?.length || 0,
        teachers: db.teachers?.length || 0,
        grades: db.grades?.length || 0,
        attendance: db.attendance?.length || 0,
        bills: db.bills?.length || 0,
        feePayments: db.feePayments?.length || 0
      }
    });
  });

  // GET /api/sync/all: Retrieve complete school database state
  app.get("/api/sync/all", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated,
      data: db
    });
  });

  // POST /api/sync/all: Bulk or partial update to master database
  app.post("/api/sync/all", (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ status: "error", message: "Invalid payload" });
    }

    const db = loadServerDatabase();

    if (incoming.config) db.config = incoming.config;
    if (Array.isArray(incoming.teachers)) db.teachers = incoming.teachers;
    if (Array.isArray(incoming.deletedStudentIds)) {
      const currentDeleted = new Set((db.deletedStudentIds || []).map(x => String(x).toLowerCase().trim()));
      incoming.deletedStudentIds.forEach((id: any) => {
        const clean = String(id).toLowerCase().trim();
        if (clean) currentDeleted.add(clean);
      });
      db.deletedStudentIds = Array.from(currentDeleted);
    }
    if (Array.isArray(incoming.deletedTeacherIds)) db.deletedTeacherIds = incoming.deletedTeacherIds;
    if (Array.isArray(incoming.students)) {
      const cleanStudents = incoming.students.filter((s: any) => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));
      db.students = cleanStudents;
      if (cleanStudents.length === 0) {
        db.rosterCleared = true;
        db.rosterClearedAt = new Date().toISOString();
      } else {
        db.rosterCleared = false;
      }
      try {
        fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(cleanStudents, null, 2), "utf-8");
      } catch (e) {}
    }
    if (incoming.rosterCleared === true) {
      db.students = [];
      db.rosterCleared = true;
      db.rosterClearedAt = new Date().toISOString();
      try {
        fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify([], null, 2), "utf-8");
      } catch (e) {}
    }
    if (Array.isArray(incoming.grades)) db.grades = incoming.grades;
    if (Array.isArray(incoming.attendance)) {
      const attMap = new Map<string, any>();
      (db.attendance || []).forEach((a: any) => {
        const key = `${a.studentId}_${a.term || ''}_${a.year || a.academicYear || ''}`;
        attMap.set(key, a);
      });
      incoming.attendance.forEach((a: any) => {
        const key = `${a.studentId}_${a.term || ''}_${a.year || a.academicYear || ''}`;
        attMap.set(key, a);
      });
      db.attendance = Array.from(attMap.values());
    }
    if (Array.isArray(incoming.dailyAttendance)) {
      const dailyMap = new Map<string, any>();
      (db.dailyAttendance || []).forEach((r: any) => {
        if (r && r.studentId && r.date) {
          dailyMap.set(`${r.studentId}_${r.date}`, r);
        }
      });
      incoming.dailyAttendance.forEach((r: any) => {
        if (r && r.studentId && r.date) {
          dailyMap.set(`${r.studentId}_${r.date}`, r);
        }
      });
      db.dailyAttendance = Array.from(dailyMap.values());
    }
    if (Array.isArray(incoming.bills)) db.bills = incoming.bills;
    if (Array.isArray(incoming.feePayments)) db.feePayments = incoming.feePayments;
    if (Array.isArray(incoming.feeStructures)) db.feeStructures = incoming.feeStructures;
    if (Array.isArray(incoming.dailyCollections)) db.dailyCollections = incoming.dailyCollections;
    if (Array.isArray(incoming.inventory)) db.inventory = incoming.inventory;
    if (Array.isArray(incoming.deletedBookStockIds)) {
      if (!db.deletedBookStockIds) db.deletedBookStockIds = [];
      incoming.deletedBookStockIds.forEach((id: string) => {
        if (id && !db.deletedBookStockIds!.includes(id)) {
          db.deletedBookStockIds!.push(id);
        }
      });
    }
    if (Array.isArray(incoming.bookStock)) {
      const activeDeleted = new Set((db.deletedBookStockIds || []).map(id => String(id).toLowerCase()));
      db.bookStock = incoming.bookStock.filter((b: any) => b && b.id && !activeDeleted.has(String(b.id).trim().toLowerCase()));
    }
    if (Array.isArray(incoming.bookSales)) db.bookSales = incoming.bookSales;
    if (Array.isArray(incoming.jhsMockExams)) db.jhsMockExams = incoming.jhsMockExams;

    saveServerDatabase(db);
    console.log(`[Global Master Sync] Full database synchronized. Version: ${db.version}`);

    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated
    });
  });

  // ==========================================
  // SPECIFIC ENTITY PERSISTENCE ENDPOINTS
  // ==========================================

  // Config: GET & POST
  app.get("/api/config", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.config, version: db.version });
  });

  app.post("/api/config", (req, res) => {
    const config = req.body?.config || req.body;
    if (!config) return res.status(400).json({ status: "error", message: "Missing config" });
    const db = loadServerDatabase();
    db.config = config;
    saveServerDatabase(db, "config", config);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Teachers: GET & POST
  app.get("/api/teachers", (req, res) => {
    const db = loadServerDatabase();
    if (!Array.isArray(db.teachers) || db.teachers.length === 0) {
      db.teachers = DEFAULT_SERVER_TEACHERS;
      saveServerDatabase(db, "teachers", DEFAULT_SERVER_TEACHERS);
    }
    return res.status(200).json({ status: "success", data: db.teachers, count: db.teachers.length, version: db.version });
  });

  app.post("/api/teachers", (req, res) => {
    const teachers = req.body?.teachers || req.body;
    if (!Array.isArray(teachers)) return res.status(400).json({ status: "error", message: "Expected teachers array" });
    const db = loadServerDatabase();
    db.teachers = teachers;
    saveServerDatabase(db, "teachers", teachers);
    return res.status(200).json({ status: "success", count: teachers.length, version: db.version });
  });

  // Grades: GET & POST
  app.get("/api/grades", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.grades || [], count: (db.grades || []).length, version: db.version });
  });

  app.post("/api/grades", (req, res) => {
    const grades = req.body?.grades || req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ status: "error", message: "Expected grades array" });
    const db = loadServerDatabase();
    
    // Merge grades intelligently by composite key (studentId + subjectId + term + academicYear)
    const gradeMap = new Map<string, any>();
    (db.grades || []).forEach(g => {
      const key = `${g.studentId}_${g.subjectId}_${g.term}_${g.academicYear || ''}`;
      gradeMap.set(key, g);
    });
    grades.forEach(g => {
      const key = `${g.studentId}_${g.subjectId}_${g.term}_${g.academicYear || ''}`;
      gradeMap.set(key, g);
    });

    db.grades = Array.from(gradeMap.values());
    saveServerDatabase(db, "grades", db.grades);
    return res.status(200).json({ status: "success", count: db.grades.length, version: db.version });
  });

  // Attendance: GET & POST
  app.get("/api/attendance", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.attendance || [], count: (db.attendance || []).length, version: db.version });
  });

  app.post("/api/attendance", (req, res) => {
    const attendance = req.body?.attendance || req.body;
    if (!Array.isArray(attendance)) return res.status(400).json({ status: "error", message: "Expected attendance array" });
    const db = loadServerDatabase();

    const attMap = new Map<string, any>();
    (db.attendance || []).forEach(a => {
      const key = `${a.studentId}_${a.term || ''}_${a.year || a.academicYear || ''}`;
      attMap.set(key, a);
    });
    attendance.forEach(a => {
      const key = `${a.studentId}_${a.term || ''}_${a.year || a.academicYear || ''}`;
      attMap.set(key, a);
    });

    db.attendance = Array.from(attMap.values());
    saveServerDatabase(db, "attendance", db.attendance);
    return res.status(200).json({ status: "success", count: db.attendance.length, version: db.version });
  });

  // Daily Attendance: GET & POST
  app.get("/api/daily-attendance", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.dailyAttendance || [], count: (db.dailyAttendance || []).length, version: db.version });
  });

  app.post("/api/daily-attendance", (req, res) => {
    const records = req.body?.dailyAttendance || req.body;
    if (!Array.isArray(records)) return res.status(400).json({ status: "error", message: "Expected array" });
    const db = loadServerDatabase();

    const dailyMap = new Map<string, any>();
    (db.dailyAttendance || []).forEach(r => {
      if (r && r.studentId && r.date) {
        dailyMap.set(`${r.studentId}_${r.date}`, r);
      }
    });
    records.forEach(r => {
      if (r && r.studentId && r.date) {
        dailyMap.set(`${r.studentId}_${r.date}`, r);
      }
    });

    db.dailyAttendance = Array.from(dailyMap.values());
    saveServerDatabase(db, "dailyAttendance", db.dailyAttendance);
    return res.status(200).json({ status: "success", count: db.dailyAttendance.length, version: db.version });
  });

  // Bills: GET & POST
  app.get("/api/bills", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bills || [], count: (db.bills || []).length, version: db.version });
  });

  app.post("/api/bills", (req, res) => {
    const bills = req.body?.bills || req.body;
    if (!Array.isArray(bills)) return res.status(400).json({ status: "error", message: "Expected bills array" });
    const db = loadServerDatabase();
    db.bills = bills;
    saveServerDatabase(db, "bills", bills);
    return res.status(200).json({ status: "success", count: bills.length, version: db.version });
  });

  // Fee Payments: GET & POST
  app.get("/api/fee-payments", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.feePayments || [], count: (db.feePayments || []).length, version: db.version });
  });

  app.post("/api/fee-payments", (req, res) => {
    const feePayments = req.body?.feePayments || req.body;
    if (!Array.isArray(feePayments)) return res.status(400).json({ status: "error", message: "Expected feePayments array" });
    const db = loadServerDatabase();
    db.feePayments = feePayments;
    saveServerDatabase(db, "feePayments", feePayments);
    return res.status(200).json({ status: "success", count: feePayments.length, version: db.version });
  });

  // Fee Structures: GET & POST
  app.get("/api/fee-structures", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.feeStructures || [], version: db.version });
  });

  app.post("/api/fee-structures", (req, res) => {
    const structures = req.body?.feeStructures || req.body;
    if (!Array.isArray(structures)) return res.status(400).json({ status: "error", message: "Expected feeStructures array" });
    const db = loadServerDatabase();
    db.feeStructures = structures;
    saveServerDatabase(db, "feeStructures", structures);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Inventory: GET & POST
  app.get("/api/inventory", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.inventory || [], version: db.version });
  });

  app.post("/api/inventory", (req, res) => {
    const inventory = req.body?.inventory || req.body;
    if (!Array.isArray(inventory)) return res.status(400).json({ status: "error", message: "Expected inventory array" });
    const db = loadServerDatabase();
    db.inventory = inventory;
    saveServerDatabase(db, "inventory", inventory);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Book Stock: GET, POST & DELETE
  app.get("/api/book-stock", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bookStock || [], version: db.version });
  });

  app.post("/api/book-stock", (req, res) => {
    const bookStock = req.body?.bookStock || req.body;
    if (!Array.isArray(bookStock)) return res.status(400).json({ status: "error", message: "Expected bookStock array" });
    const db = loadServerDatabase();
    const activeDeleted = new Set((db.deletedBookStockIds || []).map(id => String(id).toLowerCase()));
    db.bookStock = bookStock.filter(b => b && b.id && !activeDeleted.has(String(b.id).trim().toLowerCase()));
    saveServerDatabase(db, "book_stock", db.bookStock);
    return res.status(200).json({ status: "success", version: db.version });
  });

  app.delete("/api/book-stock/:id", (req, res) => {
    const rawId = req.params.id;
    if (!rawId) return res.status(400).json({ status: "error", message: "ID is required" });
    const targetId = decodeURIComponent(rawId).trim();
    const targetIdLower = targetId.toLowerCase();
    const db = loadServerDatabase();
    if (!db.deletedBookStockIds) db.deletedBookStockIds = [];
    if (!db.deletedBookStockIds.includes(targetId)) {
      db.deletedBookStockIds.push(targetId);
    }
    db.bookStock = (db.bookStock || []).filter(
      (b: any) => b && b.id && String(b.id).trim().toLowerCase() !== targetIdLower
    );
    saveServerDatabase(db, "book_stock", { action: 'DELETE', id: targetId });
    return res.status(200).json({ status: "success", version: db.version, deletedId: targetId });
  });

  // Book Sales: GET, POST & DELETE
  app.get("/api/book-sales", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bookSales || [], version: db.version });
  });

  app.post("/api/book-sales", (req, res) => {
    const bookSales = req.body?.bookSales || req.body;
    if (!Array.isArray(bookSales)) return res.status(400).json({ status: "error", message: "Expected bookSales array" });
    const db = loadServerDatabase();
    db.bookSales = bookSales;
    saveServerDatabase(db, "book_sales", bookSales);
    return res.status(200).json({ status: "success", version: db.version });
  });

  app.delete("/api/book-sales/:id", (req, res) => {
    const rawId = req.params.id;
    if (!rawId) return res.status(400).json({ status: "error", message: "ID is required" });
    const targetId = decodeURIComponent(rawId).trim();
    const targetIdLower = targetId.toLowerCase();
    const db = loadServerDatabase();
    db.bookSales = (db.bookSales || []).filter(
      (s: any) => s && s.id && String(s.id).trim().toLowerCase() !== targetIdLower
    );
    saveServerDatabase(db, "book_sales", { action: 'DELETE', id: targetId });
    return res.status(200).json({ status: "success", version: db.version, deletedId: targetId });
  });

  // JHS Mock Exams: GET & POST
  app.get("/api/jhs-mock-exams", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.jhsMockExams || [], version: db.version });
  });

  app.post("/api/jhs-mock-exams", (req, res) => {
    const exams = req.body?.jhsMockExams || req.body;
    if (!Array.isArray(exams)) return res.status(400).json({ status: "error", message: "Expected jhsMockExams array" });
    const db = loadServerDatabase();
    db.jhsMockExams = exams;
    saveServerDatabase(db, "jhsMockExams", exams);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Dedicated Service Worker and Manifest routes with appropriate headers
  app.get("/sw.js", (req, res) => {
    const swPath = path.join(process.cwd(), "public", "sw.js");
    if (fs.existsSync(swPath)) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(swPath);
    }
    return res.status(404).send("Service Worker not found");
  });

  app.get("/manifest.json", (req, res) => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(manifestPath);
    }
    return res.status(404).send("Manifest not found");
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
