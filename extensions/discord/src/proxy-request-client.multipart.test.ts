import { describe, expect, it, vi } from "vitest";
import { createDiscordRequestClient } from "./proxy-request-client.js";

describe("ProxyRequestClientCompat multipart Content-Type", () => {
  it("does not send application/json Content-Type for multipart file uploads", async () => {
    const capturedInit = { headers: null as Headers | null, body: null as BodyInit | null };
    const fakeFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit.headers = init?.headers instanceof Headers ? init.headers : new Headers();
      capturedInit.body = (init?.body as BodyInit) ?? null;
      return new Response(JSON.stringify({ id: "msg1", channel_id: "chan1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    // createDiscordRequestClient returns ProxyRequestClientCompat when fetch is provided
    const client = createDiscordRequestClient("test-token", {
      fetch: fakeFetch as unknown as typeof fetch,
      queueRequests: false,
    });

    const fileBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
      type: "image/png",
    });

    await client.post("/channels/123/messages", {
      body: {
        content: "hello",
        files: [{ data: fileBlob, name: "image.png" }],
      },
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);

    // The Content-Type must NOT be application/json for multipart uploads.
    // fetch auto-sets multipart/form-data with the correct boundary when body is FormData.
    const contentType = capturedInit.headers?.get("Content-Type");
    expect(contentType).not.toBe("application/json");

    // Body should be FormData
    expect(capturedInit.body).toBeInstanceOf(FormData);
  });

  it("sends application/json Content-Type for non-file JSON requests", async () => {
    const capturedInit = { headers: null as Headers | null };
    const fakeFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit.headers = init?.headers instanceof Headers ? init.headers : new Headers();
      return new Response(JSON.stringify({ id: "msg1", channel_id: "chan1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createDiscordRequestClient("test-token", {
      fetch: fakeFetch as unknown as typeof fetch,
      queueRequests: false,
    });

    await client.post("/channels/123/messages", {
      body: { content: "hello" },
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(capturedInit.headers?.get("Content-Type")).toBe("application/json");
  });

  it("removes pre-set Content-Type header when sending multipart file uploads", async () => {
    const capturedInit = { headers: null as Headers | null };
    const fakeFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit.headers = init?.headers instanceof Headers ? init.headers : new Headers();
      return new Response(JSON.stringify({ id: "msg1", channel_id: "chan1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createDiscordRequestClient("test-token", {
      fetch: fakeFetch as unknown as typeof fetch,
      queueRequests: false,
    });

    const fileBlob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });

    // Pass explicit Content-Type header in the request data — the multipart
    // branch must remove it so fetch auto-sets multipart/form-data.
    await client.post("/channels/123/messages", {
      body: {
        content: "photo",
        files: [{ data: fileBlob, name: "photo.jpg" }],
      },
      headers: { "Content-Type": "application/json" },
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const contentType = capturedInit.headers?.get("Content-Type");
    expect(contentType).not.toBe("application/json");
  });
});
