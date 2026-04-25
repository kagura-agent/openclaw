import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startSharkordGateway } from "./gateway.js";
import type { SharkordGatewayHandle } from "./gateway.js";
import type { BridgeEvent } from "./types.js";

let handle: SharkordGatewayHandle | undefined;

function startGateway(
  bridgeSecret?: string,
): Promise<{ port: number; onMessage: ReturnType<typeof vi.fn> }> {
  const onMessage = vi.fn().mockResolvedValue(undefined);

  // Spy on http.createServer to capture the server instance
  const origCreate = http.createServer;
  let server: http.Server | undefined;
  vi.spyOn(http, "createServer").mockImplementationOnce((...args: any[]) => {
    server = origCreate.apply(http, args as any);
    return server;
  });

  return new Promise((resolve) => {
    handle = startSharkordGateway(
      { listenPort: 0, bridgeSecret },
      {
        onMessage,
        onConnected: () => {
          const addr = server!.address() as { port: number };
          resolve({ port: addr.port, onMessage });
        },
        log: () => {},
      },
    );
  });
}

describe("startSharkordGateway", () => {
  afterEach(async () => {
    if (handle) {
      await handle.stop();
      handle = undefined;
    }
    vi.restoreAllMocks();
  });

  it("returns 200 on GET /health", async () => {
    const { port } = await startGateway();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", channel: "sharkord" });
  });

  it("returns 404 for unknown paths", async () => {
    const { port } = await startGateway();
    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("dispatches message:created events to onMessage", async () => {
    const { port, onMessage } = await startGateway();

    const event: BridgeEvent = {
      type: "message:created",
      messageId: "m1",
      channelId: 10,
      userId: "u1",
      content: "hi",
      htmlContent: "<p>hi</p>",
      timestamp: 123,
    };

    const res = await fetch(`http://127.0.0.1:${port}/sharkord/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    expect(res.status).toBe(200);
    expect(onMessage).toHaveBeenCalledWith(event);
  });

  it("returns 401 when bridgeSecret is set and auth is missing", async () => {
    const { port } = await startGateway("secret123");

    const res = await fetch(`http://127.0.0.1:${port}/sharkord/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "message:created" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 when bridgeSecret is set and auth is wrong", async () => {
    const { port } = await startGateway("secret123");

    const res = await fetch(`http://127.0.0.1:${port}/sharkord/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong",
      },
      body: JSON.stringify({ type: "message:created" }),
    });

    expect(res.status).toBe(401);
  });

  it("accepts request with correct bridgeSecret", async () => {
    const { port } = await startGateway("secret123");

    const res = await fetch(`http://127.0.0.1:${port}/sharkord/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret123",
      },
      body: JSON.stringify({
        type: "message:created",
        messageId: "m1",
        channelId: 1,
        userId: "u1",
        content: "",
        htmlContent: "",
        timestamp: 0,
      }),
    });

    expect(res.status).toBe(200);
  });

  it("returns 500 for invalid JSON body", async () => {
    const { port } = await startGateway();

    const res = await fetch(`http://127.0.0.1:${port}/sharkord/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });

    expect(res.status).toBe(500);
  });
});
