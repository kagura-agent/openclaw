/**
 * Sharkord gateway — HTTP server that receives webhook events from the
 * Sharkord bridge plugin.
 *
 * The bridge POSTs to POST /sharkord/event with a Bearer token.
 */

import { createServer, type Server } from "node:http";
import type { SharkordBridgeEvent } from "./types.js";

export interface GatewayCallbacks {
  onMessage: (event: SharkordBridgeEvent) => void | Promise<void>;
  onError?: (error: unknown) => void;
  log?: (message: string) => void;
}

export interface GatewayHandle {
  stop(): Promise<void>;
  port: number;
}

export interface GatewayOptions {
  listenPort: number;
  bridgeSecret: string;
  abortSignal?: AbortSignal;
}

/**
 * Start an HTTP server to receive events from the Sharkord bridge plugin.
 */
export function startSharkordGateway(
  options: GatewayOptions,
  callbacks: GatewayCallbacks,
): Promise<GatewayHandle> {
  const { listenPort, bridgeSecret } = options;

  return new Promise((resolve, reject) => {
    const server: Server = createServer(async (req, res) => {
      // Only accept POST /sharkord/event
      if (req.method !== "POST" || req.url !== "/sharkord/event") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }

      // Validate Bearer auth
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${bridgeSecret}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }

      // Read body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks).toString("utf-8");

      let event: SharkordBridgeEvent;
      try {
        event = JSON.parse(body) as SharkordBridgeEvent;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON" }));
        return;
      }

      if (event.type !== "message:created") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, skipped: true }));
        return;
      }

      try {
        await callbacks.onMessage(event);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        callbacks.onError?.(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      }
    });

    // Handle abort signal
    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        server.close();
      });
    }

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(listenPort, "127.0.0.1", () => {
      const addr = server.address();
      const resolvedPort = typeof addr === "object" && addr ? addr.port : listenPort;
      callbacks.log?.(`sharkord: gateway listening on 127.0.0.1:${resolvedPort}`);
      resolve({
        port: resolvedPort,
        async stop() {
          return new Promise<void>((res) => {
            server.close(() => res());
          });
        },
      });
    });
  });
}
