import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes
  app.get("/api/config", (req, res) => {
    res.json({
      API_KEY: process.env.API_KEY || "",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "",
      VEO_MODEL_NAME: process.env.VEO_MODEL_NAME || "veo-3.1-fast-generate-preview",
    });
  });

  // API proxy route
  app.all("/api-proxy/*path", async (req, res) => {
    const serverApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const targetPath = req.params.path;
    const googleUrl = `https://generativelanguage.googleapis.com/${targetPath}`;

    // Forward headers from the client, but override/set the API key
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && !['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    // Use the key from the request header if present and not empty, otherwise fallback to server-side key
    const clientApiKey = headers['x-goog-api-key'];
    const apiKey = (clientApiKey && clientApiKey !== "undefined" && clientApiKey !== "") ? clientApiKey : serverApiKey;
    
    // We'll pass the key via the header for consistency with the SDK
    headers['x-goog-api-key'] = apiKey;
    headers['Content-Type'] = 'application/json';

    try {
      const response = await fetch(googleUrl, {
        method: req.method,
        headers: headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      });

      // Forward the status code
      res.status(response.status);

      // Forward headers from Google back to the client
      for (const [key, value] of response.headers.entries()) {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(500).json({ error: "Proxy request failed", details: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*path", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
