import http from "node:http";
import type { BridgeEvent } from "./types.js";

export interface SharkordGatewayCallbacks {
  onMessage: (event: BridgeEvent) => Promise<void>;
  onError?: (err: unknown) => void;
  onConnected?: () => void;
  log?: (msg: string) => void;
}

export interface SharkordGatewayHandle {
  stop: () => Promise<void>;
}

/**
 * Start an HTTP server that receives webhook events from the Sharkord bridge plugin.
 */
export function startSharkordGateway(
  config: {
    listenPort: number;
    bridgeSecret?: string;
  },
  callbacks: SharkordGatewayCallbacks,
  opts?: { abortSignal?: AbortSignal },
): SharkordGatewayHandle {
  const { listenPort, bridgeSecret } = config;

  const server = http.createServer(async (req, res) => {
    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", channel: "sharkord" }));
      return;
    }

    // Only accept POST /sharkord/event
    if (req.method !== "POST" || req.url !== "/sharkord/event") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Auth check
    if (bridgeSecret) {
      const auth = req.headers["authorization"];
      if (auth !== `Bearer ${bridgeSecret}`) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
    }

    // Read body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString("utf-8");

    try {
      const event = JSON.parse(body) as BridgeEvent;

      if (event.type === "message:created") {
        await callbacks.onMessage(event);
      }
      // TODO: handle message:updated, message:deleted

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      callbacks.onError?.(err);
      res.writeHead(500);
      res.end("Internal error");
    }
  });

  server.listen(listenPort, () => {
    callbacks.log?.(`sharkord: gateway listening on port ${listenPort}`);
    callbacks.onConnected?.();
  });

  // Handle abort signal
  opts?.abortSignal?.addEventListener("abort", () => {
    server.close();
  });

  return {
    stop: async () => {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
