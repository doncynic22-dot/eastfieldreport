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
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required." });
      }

      const response = await fetch("https://sms.arkesel.com/api/v2/clients/balance", {
        method: "GET",
        headers: {
          "api-key": apiKey,
          "Accept": "application/json"
        }
      });

      const data = await response.json().catch(() => null);
      if (!data) {
        return res.status(502).json({ status: "error", message: "Invalid JSON response from Arkesel" });
      }

      return res.status(response.status).json(data);
    } catch (err: any) {
      console.error("Arkesel balance proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to connect to Arkesel" });
    }
  });

  // API Route: Send Bulk SMS via Arkesel Gateway
  app.post("/api/sms/send", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required." });
      }

      const { sender, message, recipients } = req.body || {};

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ status: "error", message: "Recipients list is required." });
      }

      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: sender || "EASTFIELD",
          message: message || "",
          recipients: recipients
        })
      });

      const data = await response.json().catch(() => null);
      if (!data) {
        return res.status(502).json({ status: "error", message: "Invalid response from Arkesel gateway" });
      }

      return res.status(response.status).json(data);
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
