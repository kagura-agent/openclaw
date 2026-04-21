/**
 * Unit tests for Zulip message sending.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZulipClient } from "./client.js";
import { sendMessageZulip, sendMediaZulip } from "./send.js";

// Mock ZulipClient
vi.mock("./client.js", () => {
  const ZulipClient = vi.fn();
  ZulipClient.prototype.sendMessage = vi.fn();
  ZulipClient.prototype.uploadFile = vi.fn();
  return { ZulipClient };
});

vi.mock("./runtime.js", () => ({
  getZulipRuntime: () => ({}),
}));

const TEST_CONFIG = {
  realm: "https://test.zulipchat.com",
  email: "bot@test.zulipchat.com",
  apiKey: "test-key",
};

describe("sendMessageZulip", () => {
  let client: ZulipClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ZulipClient(TEST_CONFIG);
    (client.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
  });

  it("sends to stream#topic", async () => {
    const result = await sendMessageZulip("general#greetings", "Hello", { client });
    expect(result.messageId).toBe(1);
    expect(result.target).toBe("general#greetings");
    expect(client.sendMessage).toHaveBeenCalledWith({
      type: "channel",
      to: "general",
      topic: "greetings",
      content: "Hello",
    });
  });

  it("uses default topic when only stream is given via stream#", async () => {
    await sendMessageZulip("general#", "Hi", { client });
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "channel",
        to: "general",
        topic: "general", // DEFAULT_TOPIC
      }),
    );
  });

  it("sends DM to numeric user ID", async () => {
    // normalizeZulipMessagingTarget("direct:42") → "42"
    await sendMessageZulip("direct:42", "Hey", { client });
    expect(client.sendMessage).toHaveBeenCalledWith({
      type: "direct",
      to: [42],
      content: "Hey",
    });
  });

  it("throws on empty message", async () => {
    await expect(sendMessageZulip("general#test", "   ", { client })).rejects.toThrow("non-empty");
  });

  it("throws on invalid target", async () => {
    await expect(sendMessageZulip("", "Hi", { client })).rejects.toThrow("Invalid Zulip target");
  });

  it("throws when no client available", async () => {
    await expect(sendMessageZulip("general#test", "Hi", {})).rejects.toThrow("No ZulipClient");
  });

  it("creates client from clientConfig if no client provided", async () => {
    const MockedZulipClient = ZulipClient as unknown as ReturnType<typeof vi.fn>;
    MockedZulipClient.prototype.sendMessage.mockResolvedValue({ id: 5 });
    const result = await sendMessageZulip("general#test", "Hi", { clientConfig: TEST_CONFIG });
    expect(result.messageId).toBe(5);
  });
});

describe("sendMediaZulip", () => {
  let client: ZulipClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ZulipClient(TEST_CONFIG);
    (client.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "/user_uploads/1/abc/image.png",
    });
    (client.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 10 });
  });

  it("uploads file and sends link", async () => {
    const blob = new Blob(["test"], { type: "image/png" });
    const result = await sendMediaZulip("general#media", "image.png", blob, "image/png", {
      client,
    });
    expect(client.uploadFile).toHaveBeenCalledWith("image.png", blob, "image/png");
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "[image.png](/user_uploads/1/abc/image.png)",
      }),
    );
    expect(result.messageId).toBe(10);
  });

  it("includes caption when provided", async () => {
    const blob = new Blob(["test"]);
    await sendMediaZulip("general#media", "doc.pdf", blob, "application/pdf", {
      client,
      caption: "Check this out",
    });
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Check this out\n[doc.pdf](/user_uploads/1/abc/image.png)",
      }),
    );
  });

  it("prefers url over uri in upload response", async () => {
    (client.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({
      uri: "/old",
      url: "/new/path",
    });
    const blob = new Blob(["x"]);
    await sendMediaZulip("general#test", "f.txt", blob, "text/plain", { client });
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "[f.txt](/new/path)",
      }),
    );
  });
});
