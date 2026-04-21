/**
 * Unit tests for Zulip inbound message normalization.
 */

import { describe, it, expect } from "vitest";
import { normalizeZulipEvent, buildInboundTarget } from "./inbound.js";
import type { MessageEvent } from "./types.js";

function makeStreamEvent(
  overrides?: Partial<MessageEvent["message"]>,
  flags?: string[],
): MessageEvent {
  return {
    type: "message",
    id: 1,
    flags: flags ?? [],
    message: {
      id: 100,
      sender_id: 42,
      sender_email: "alice@example.com",
      sender_full_name: "Alice",
      type: "stream",
      stream_id: 5,
      display_recipient: "general",
      subject: "greetings",
      content: "Hello world",
      timestamp: 1700000000,
      ...overrides,
    },
  };
}

function makeDmEvent(overrides?: Partial<MessageEvent["message"]>, flags?: string[]): MessageEvent {
  return {
    type: "message",
    id: 2,
    flags: flags ?? [],
    message: {
      id: 200,
      sender_id: 42,
      sender_email: "alice@example.com",
      sender_full_name: "Alice",
      type: "private",
      display_recipient: [
        { id: 42, email: "alice@example.com", full_name: "Alice" },
        { id: 99, email: "bot@example.com", full_name: "Bot" },
      ],
      subject: "",
      content: "Hey bot",
      timestamp: 1700000001,
      ...overrides,
    },
  };
}

describe("normalizeZulipEvent", () => {
  it("normalizes a stream message", () => {
    const result = normalizeZulipEvent(makeStreamEvent());
    expect(result.isGroup).toBe(true);
    expect(result.stream).toBe("general");
    expect(result.topic).toBe("greetings");
    expect(result.text).toBe("Hello world");
    expect(result.senderId).toBe(42);
    expect(result.senderEmail).toBe("alice@example.com");
    expect(result.senderName).toBe("Alice");
    expect(result.messageId).toBe(100);
    expect(result.streamId).toBe(5);
    expect(result.wasMentioned).toBe(false);
  });

  it("normalizes a DM message", () => {
    const result = normalizeZulipEvent(makeDmEvent(), 99);
    expect(result.isGroup).toBe(false);
    expect(result.stream).toBeUndefined();
    expect(result.topic).toBeUndefined();
    expect(result.text).toBe("Hey bot");
    expect(result.dmRecipientIds).toEqual([42]); // excludes own id 99
  });

  it("detects @-mention flag", () => {
    const result = normalizeZulipEvent(makeStreamEvent({}, ["mentioned"]));
    expect(result.wasMentioned).toBe(true);
  });

  it("detects wildcard mention flag", () => {
    const result = normalizeZulipEvent(makeStreamEvent({}, ["wildcard_mentioned"]));
    expect(result.wasMentioned).toBe(true);
  });

  it("handles DM without ownUserId (keeps all recipients)", () => {
    const result = normalizeZulipEvent(makeDmEvent());
    expect(result.dmRecipientIds).toEqual([42, 99]);
  });

  it("handles stream message with no stream_id", () => {
    const result = normalizeZulipEvent(makeStreamEvent({ stream_id: undefined }));
    expect(result.isGroup).toBe(true);
    expect(result.streamId).toBeUndefined();
  });
});

describe("buildInboundTarget", () => {
  it("builds group target with stream#topic", () => {
    const msg = normalizeZulipEvent(makeStreamEvent());
    expect(buildInboundTarget(msg, "mybot")).toBe("zulip:mybot:group:general#greetings");
  });

  it("builds direct target for DM", () => {
    const msg = normalizeZulipEvent(makeDmEvent());
    expect(buildInboundTarget(msg, "mybot")).toBe("zulip:mybot:direct:42");
  });

  it("builds group target without topic", () => {
    const msg = normalizeZulipEvent(makeStreamEvent({ subject: "" }));
    // formatStreamTopic with empty topic should just return stream name
    expect(buildInboundTarget(msg, "mybot")).toBe("zulip:mybot:group:general");
  });
});
