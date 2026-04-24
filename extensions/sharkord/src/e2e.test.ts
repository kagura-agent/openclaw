/**
 * Sharkord Extension — E2E Integration Tests
 *
 * Tests the full message round-trip:
 *   Bridge event → Gateway HTTP → onMessage → sendTextToSharkord → Mock Bridge /send
 *
 * No real Sharkord server needed — we mock the bridge side.
 */

import http from "node:http";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startSharkordGateway } from "./gateway.js";
import { sendTextToSharkord, sendMessageSharkord } from "./send.js";
import type { BridgeEvent, BridgeSendRequest } from "./types.js";

// ─── Mock Bridge Server ───

interface ReceivedSendRequest {
  channelId: number;
  content: string;
  replyTo?: string;
  parentMessageId?: string;
}

function startMockBridge(port: number) {
  const received: ReceivedSendRequest[] = [];
  let nextMessageId = 100;

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", pluginId: "mock-bridge" }));
      return;
    }

    if (req.method === "POST" && req.url === "/send") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as BridgeSendRequest;

      received.push({
        channelId: body.channelId,
        content: body.content,
        replyTo: body.replyTo,
        parentMessageId: body.parentMessageId,
      });

      const messageId = String(nextMessageId++);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ messageId }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise<{
    server: http.Server;
    received: ReceivedSendRequest[];
    stop: () => Promise<void>;
  }>((resolve) => {
    server.listen(port, () => {
      resolve({
        server,
        received,
        stop: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// ─── Helper: POST event to gateway ───

async function postBridgeEvent(
  gatewayPort: number,
  event: BridgeEvent,
  secret?: string,
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const res = await fetch(`http://localhost:${gatewayPort}/sharkord/event`, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });

  return { status: res.status, body: await res.text() };
}

function makeBridgeEvent(overrides?: Partial<BridgeEvent>): BridgeEvent {
  return {
    type: "message:created",
    messageId: "42",
    channelId: 1,
    userId: "user-1",
    userName: "TestUser",
    content: "Hello Kagura!",
    htmlContent: "<p>Hello Kagura!</p>",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Tests ───

describe("Sharkord E2E: gateway ↔ bridge round-trip", () => {
  const GATEWAY_PORT = 14994; // high port to avoid conflicts
  const BRIDGE_PORT = 14993;
  const BRIDGE_SECRET = "test-secret-e2e";

  let mockBridge: Awaited<ReturnType<typeof startMockBridge>>;
  let gatewayHandle: ReturnType<typeof startSharkordGateway>;
  let inboundMessages: BridgeEvent[];

  beforeAll(async () => {
    inboundMessages = [];

    // Start mock bridge (simulates Sharkord's bridge plugin)
    mockBridge = await startMockBridge(BRIDGE_PORT);

    // Start gateway (the real extension component)
    await new Promise<void>((resolve) => {
      gatewayHandle = startSharkordGateway(
        { listenPort: GATEWAY_PORT, bridgeSecret: BRIDGE_SECRET },
        {
          onMessage: async (event) => {
            inboundMessages.push(event);
          },
          onConnected: () => resolve(),
        },
      );
    });
  });

  afterAll(async () => {
    await gatewayHandle?.stop();
    await mockBridge?.stop();
  });

  it("gateway health check returns ok", async () => {
    const res = await fetch(`http://localhost:${GATEWAY_PORT}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", channel: "sharkord" });
  });

  it("rejects unauthenticated requests when secret is configured", async () => {
    const event = makeBridgeEvent();
    const { status } = await postBridgeEvent(GATEWAY_PORT, event);
    expect(status).toBe(401);
  });

  it("rejects wrong secret", async () => {
    const event = makeBridgeEvent();
    const { status } = await postBridgeEvent(GATEWAY_PORT, event, "wrong-secret");
    expect(status).toBe(401);
  });

  it("accepts authenticated event and fires onMessage", async () => {
    const event = makeBridgeEvent({ messageId: "e2e-1", content: "round trip test" });

    const { status } = await postBridgeEvent(GATEWAY_PORT, event, BRIDGE_SECRET);
    expect(status).toBe(200);
    expect(inboundMessages).toHaveLength(1);
    expect(inboundMessages[0]!.messageId).toBe("e2e-1");
    expect(inboundMessages[0]!.content).toBe("round trip test");
  });

  it("sends response back via mock bridge /send", async () => {
    const result = await sendTextToSharkord("sharkord:default:channel:1", "Hello from Kagura!", {
      bridgeUrl: `http://localhost:${BRIDGE_PORT}`,
      bridgeSecret: BRIDGE_SECRET,
    });

    expect(result.messageId).toBe("100");
    expect(mockBridge.received).toHaveLength(1);
    expect(mockBridge.received[0]!.channelId).toBe(1);
    expect(mockBridge.received[0]!.content).toContain("Hello from Kagura!");
  });

  it("sends reply with replyTo", async () => {
    const result = await sendTextToSharkord("sharkord:default:channel:1", "Reply!", {
      bridgeUrl: `http://localhost:${BRIDGE_PORT}`,
      bridgeSecret: BRIDGE_SECRET,
      replyTo: "42",
    });

    expect(result.messageId).toBe("101");
    expect(mockBridge.received).toHaveLength(2);
    expect(mockBridge.received[1]!.replyTo).toBe("42");
  });

  it("full round-trip: event in → process → respond out", async () => {
    // Simulate: user sends message → bridge forwards to gateway → agent processes → sends response
    const userEvent = makeBridgeEvent({
      messageId: "e2e-rt",
      channelId: 5,
      userId: "luna",
      userName: "Luna",
      content: "What's the weather?",
    });

    // Step 1: Bridge sends event to gateway
    const { status } = await postBridgeEvent(GATEWAY_PORT, userEvent, BRIDGE_SECRET);
    expect(status).toBe(200);

    // Step 2: Gateway received the message
    const received = inboundMessages.find((m) => m.messageId === "e2e-rt");
    expect(received).toBeDefined();
    expect(received!.userId).toBe("luna");

    // Step 3: "Agent" generates response and sends back via bridge
    const response = await sendTextToSharkord(
      "sharkord:default:channel:5",
      "It's sunny today! ☀️",
      {
        bridgeUrl: `http://localhost:${BRIDGE_PORT}`,
        bridgeSecret: BRIDGE_SECRET,
        replyTo: "e2e-rt",
      },
    );

    expect(response.messageId).toBeTruthy();

    // Step 4: Verify the mock bridge received the correct outbound
    const lastSent = mockBridge.received[mockBridge.received.length - 1]!;
    expect(lastSent.channelId).toBe(5);
    expect(lastSent.content).toContain("sunny today");
    expect(lastSent.replyTo).toBe("e2e-rt");
  });

  it("rejects non-POST to event endpoint", async () => {
    const res = await fetch(`http://localhost:${GATEWAY_PORT}/sharkord/event`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`http://localhost:${GATEWAY_PORT}/unknown`);
    expect(res.status).toBe(404);
  });
});

describe("Sharkord E2E: gateway without auth", () => {
  const GATEWAY_PORT = 14995;
  const BRIDGE_PORT = 14996;

  let mockBridge: Awaited<ReturnType<typeof startMockBridge>>;
  let gatewayHandle: ReturnType<typeof startSharkordGateway>;
  let inboundMessages: BridgeEvent[];

  beforeAll(async () => {
    inboundMessages = [];
    mockBridge = await startMockBridge(BRIDGE_PORT);

    await new Promise<void>((resolve) => {
      gatewayHandle = startSharkordGateway(
        { listenPort: GATEWAY_PORT }, // no bridgeSecret
        {
          onMessage: async (event) => {
            inboundMessages.push(event);
          },
          onConnected: () => resolve(),
        },
      );
    });
  });

  afterAll(async () => {
    await gatewayHandle?.stop();
    await mockBridge?.stop();
  });

  it("accepts unauthenticated events when no secret configured", async () => {
    const event = makeBridgeEvent({ messageId: "noauth-1" });
    const { status } = await postBridgeEvent(GATEWAY_PORT, event);
    expect(status).toBe(200);
    expect(inboundMessages).toHaveLength(1);
  });

  it("sendMessageSharkord works without secret", async () => {
    const result = await sendMessageSharkord(`http://localhost:${BRIDGE_PORT}`, undefined, {
      channelId: 1,
      content: "<p>No auth needed</p>",
    });
    expect(result.messageId).toBeTruthy();
  });
});
