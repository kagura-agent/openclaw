import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessageSharkord, sendTextToSharkord } from "./send.js";

describe("sendMessageSharkord", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messageId: "sent-1" }), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to bridgeUrl/send with JSON body", async () => {
    await sendMessageSharkord("http://bridge:3000", undefined, {
      channelId: 7,
      content: "<p>hi</p>",
    });

    expect(fetch).toHaveBeenCalledWith("http://bridge:3000/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: 7, content: "<p>hi</p>" }),
    });
  });

  it("includes Authorization header when bridgeSecret is set", async () => {
    await sendMessageSharkord("http://bridge:3000", "s3cret", {
      channelId: 1,
      content: "x",
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer s3cret");
  });

  it("omits Authorization header when bridgeSecret is undefined", async () => {
    await sendMessageSharkord("http://bridge:3000", undefined, {
      channelId: 1,
      content: "x",
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("returns parsed response", async () => {
    const result = await sendMessageSharkord("http://b", undefined, {
      channelId: 1,
      content: "x",
    });
    expect(result).toEqual({ messageId: "sent-1" });
  });

  it("throws on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("bad", { status: 500 }));
    await expect(
      sendMessageSharkord("http://b", undefined, { channelId: 1, content: "x" }),
    ).rejects.toThrow("Bridge /send failed: 500");
  });
});

describe("sendTextToSharkord", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messageId: "m-1" }), { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses channelId from target and wraps text in <p> tags", async () => {
    const result = await sendTextToSharkord("sharkord:default:channel:42", "hello", {
      bridgeUrl: "http://bridge",
    });

    expect(result).toEqual({ messageId: "m-1", target: "sharkord:default:channel:42" });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.channelId).toBe(42);
    expect(body.content).toBe("<p>hello</p>");
  });

  it("escapes HTML entities in text", async () => {
    await sendTextToSharkord("sharkord:default:channel:1", '<script>"xss"&', {
      bridgeUrl: "http://bridge",
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.content).toBe("<p>&lt;script&gt;&quot;xss&quot;&amp;</p>");
  });

  it("passes replyTo and parentMessageId", async () => {
    await sendTextToSharkord("sharkord:default:channel:1", "reply", {
      bridgeUrl: "http://bridge",
      replyTo: "r-1",
      parentMessageId: "p-1",
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]!.body as string);
    expect(body.replyTo).toBe("r-1");
    expect(body.parentMessageId).toBe("p-1");
  });
});
