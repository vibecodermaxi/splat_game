/**
 * HTTP health check server for Railway deployment.
 * Exposes GET /health returning 200 with JSON status.
 * Uses Node.js built-in http module — no extra dependencies.
 */

import * as http from "http";
import { logger } from "./logger";

/**
 * Start a lightweight HTTP server for health checks.
 *
 * Railway sets the PORT env var automatically. Defaults to 3000.
 * GET /health → 200 { status: "ok", uptime, timestamp }
 * All other routes → 404 { error: "not found" }
 */
export function startHealthServer(port?: number): void {
  const resolvedPort = port ?? parseInt(process.env.PORT || "3000", 10);

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const body = JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
    } else {
      const body = JSON.stringify({ error: "not found" });
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(body);
    }
  });

  server.listen(resolvedPort, () => {
    logger.info({ event: "health_server_started", port: resolvedPort });
  });
}
