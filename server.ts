import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Storage path for student registry cache
const STUDENTS_CACHE_FILE = path.join(process.cwd(), "students_registry.json");

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

function loadServerStudents(): any[] {
  try {
    if (fs.existsSync(STUDENTS_CACHE_FILE)) {
      const data = fs.readFileSync(STUDENTS_CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.filter(s => !isDemoStudent(s));
    }
  } catch (err) {
    console.warn("[Server Students] Failed to read students cache:", err);
  }
  return [];
}

function saveServerStudents(students: any[]): boolean {
  try {
    const clean = (students || []).filter(s => !isDemoStudent(s));
    fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(clean, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.warn("[Server Students] Failed to write students cache:", err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    // Ensure CDNs, proxies, and browser caches never serve stale pupil rosters
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const students = loadServerStudents();
    return res.status(200).json({
      status: "success",
      students,
      count: students.length,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/admit: Instantly admit or update a single pupil globally
  app.post("/api/students/admit", (req, res) => {
    const student = req.body?.student;
    if (!student || (!student.id && !student.name)) {
      return res.status(400).json({ status: "error", message: "Invalid student payload" });
    }

    const currentStudents = loadServerStudents();
    const cleanId = String(student.id || `st-${Date.now()}`);
    const cleanRoll = String(student.rollNumber || "").trim();

    // Check if student already exists by ID or Roll Number
    const existingIndex = currentStudents.findIndex(
      s => s.id === cleanId || (cleanRoll && s.rollNumber && s.rollNumber.trim().toLowerCase() === cleanRoll.toLowerCase())
    );

    const normalizedStudent = {
      ...student,
      id: cleanId,
      updated_at: new Date().toISOString()
    };

    let updatedList: any[];
    if (existingIndex >= 0) {
      updatedList = currentStudents.map((s, idx) => idx === existingIndex ? normalizedStudent : s);
    } else {
      updatedList = [...currentStudents, normalizedStudent];
    }

    saveServerStudents(updatedList);
    console.log(`[Global Student Sync] Pupil '${normalizedStudent.name}' admitted / updated. Total pupils: ${updatedList.length}`);

    return res.status(200).json({
      status: "success",
      student: normalizedStudent,
      count: updatedList.length,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students: Bulk sync entire student roster
  app.post("/api/students", (req, res) => {
    const students = req.body?.students;
    if (!Array.isArray(students)) {
      return res.status(400).json({ status: "error", message: "Expected students array" });
    }

    // Merge non-destructively with existing students in server cache
    const currentStudents = loadServerStudents();
    const studentMap = new Map<string, any>();

    // Seed existing
    currentStudents.forEach(s => {
      const key = s.id || (s.rollNumber ? s.rollNumber.toLowerCase().trim() : undefined);
      if (key) studentMap.set(key, s);
    });

    // Upsert incoming
    students.forEach(s => {
      const key = s.id || (s.rollNumber ? s.rollNumber.toLowerCase().trim() : undefined);
      if (key) studentMap.set(key, s);
    });

    const mergedStudents = Array.from(studentMap.values());
    saveServerStudents(mergedStudents);

    return res.status(200).json({
      status: "success",
      count: mergedStudents.length,
      timestamp: new Date().toISOString()
    });
  });

  // DELETE /api/students/:id: Delete pupil from global server store
  app.delete("/api/students/:id", (req, res) => {
    const targetId = req.params.id;
    const { rollNumber } = req.body || {};

    const currentStudents = loadServerStudents();
    const updated = currentStudents.filter(s => {
      if (s.id === targetId) return false;
      if (rollNumber && s.rollNumber && s.rollNumber.toLowerCase().trim() === rollNumber.toLowerCase().trim()) return false;
      return true;
    });

    saveServerStudents(updated);
    console.log(`[Global Student Sync] Student ID '${targetId}' deleted. Remaining pupils: ${updated.length}`);

    return res.status(200).json({
      status: "success",
      count: updated.length
    });
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
