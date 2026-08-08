import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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

      // 1. Try Arkesel v2 API balance endpoint first
      let response = await fetch("https://sms.arkesel.com/api/v2/clients/balance", {
        method: "GET",
        headers: {
          "api-key": apiKey.trim(),
          "Accept": "application/json"
        }
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          return res.status(200).json(data);
        }
      }

      // 2. Try Arkesel v1 API balance endpoint fallback
      const v1Url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey.trim())}`;
      const v1Response = await fetch(v1Url, { method: "GET" }).catch(() => null);

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
      return res.status(status).json({
        status: "error",
        message: "Unable to connect to Arkesel SMS Gateway. Please double-check your Arkesel API key."
      });
    } catch (err: any) {
      console.error("Arkesel balance proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to connect to Arkesel gateway" });
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

      // 1. Primary: Try Arkesel v2 API POST endpoint
      let v2Response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
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

      if (v2Response && v2Response.ok) {
        const v2Data = await v2Response.json().catch(() => null);
        if (v2Data && (v2Data.status === "success" || v2Data.code === "100" || v2Data.code === 100 || v2Data.status === 200)) {
          return res.status(200).json(v2Data);
        }
      }

      // 2. Secondary Fallback: Try Arkesel v1 API GET endpoint
      const phoneListStr = cleanRecipients.join(",");
      const v1Url = new URL("https://sms.arkesel.com/sms/api");
      v1Url.searchParams.append("action", "send-sms");
      v1Url.searchParams.append("api_key", apiKey.trim());
      v1Url.searchParams.append("to", phoneListStr);
      v1Url.searchParams.append("from", cleanSender);
      v1Url.searchParams.append("sms", cleanMessage);

      const v1Response = await fetch(v1Url.toString(), { method: "GET" }).catch(() => null);
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

      return res.status(400).json({
        status: "error",
        message: "Arkesel Gateway Error (HTTP 404/400). Please verify that your API Key is valid and your Sender ID is registered in your Arkesel dashboard."
      });
    } catch (err: any) {
      console.error("Arkesel SMS proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to dispatch Arkesel SMS" });
    }
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
