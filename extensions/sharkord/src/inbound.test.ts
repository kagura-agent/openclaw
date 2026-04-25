import { describe, expect, it } from "vitest";
import { normalizeBridgeEvent, buildInboundTarget } from "./inbound.js";
import type { BridgeEvent, SharkordInboundMessage } from "./types.js";

const baseEvent: BridgeEvent = {
  type: "message:created",
  messageId: "msg-1",
  channelId: 42,
  userId: "user-a",
  userName: "Alice",
  content: "hello",
  htmlContent: "<p>hello</p>",
  timestamp: 1700000000,
  parentMessageId: "parent-1",
  replyToMessageId: "reply-1",
};

describe("normalizeBridgeEvent", () => {
  it("maps BridgeEvent fields to SharkordInboundMessage", () => {
    const msg = normalizeBridgeEvent(baseEvent);
    expect(msg).toEqual({
      messageId: "msg-1",
      channelId: 42,
      userId: "user-a",
      userName: "Alice",
      text: "hello",
      htmlContent: "<p>hello</p>",
      timestamp: 1700000000,
      isGroup: true,
      parentMessageId: "parent-1",
      replyToMessageId: "reply-1",
    });
  });

  it("handles missing optional fields", () => {
    const minimal: BridgeEvent = {
      type: "message:created",
      messageId: "m2",
      channelId: 1,
      userId: null,
      content: "",
      htmlContent: "",
      timestamp: 0,
    };
    const msg = normalizeBridgeEvent(minimal);
    expect(msg.userId).toBeNull();
    expect(msg.userName).toBeUndefined();
    expect(msg.parentMessageId).toBeUndefined();
    expect(msg.replyToMessageId).toBeUndefined();
  });
});

describe("buildInboundTarget", () => {
  it("builds channel target for group messages", () => {
    const msg: SharkordInboundMessage = {
      ...normalizeBridgeEvent(baseEvent),
      isGroup: true,
    };
    expect(buildInboundTarget(msg, "acct1")).toBe("sharkord:acct1:channel:42");
  });

  it("builds dm target for non-group messages", () => {
    const msg: SharkordInboundMessage = {
      ...normalizeBridgeEvent(baseEvent),
      isGroup: false,
    };
    expect(buildInboundTarget(msg, "acct1")).toBe("sharkord:acct1:dm:user-a");
  });

  it("uses 'unknown' when userId is null in DM", () => {
    const msg: SharkordInboundMessage = {
      ...normalizeBridgeEvent({ ...baseEvent, userId: null }),
      isGroup: false,
    };
    expect(buildInboundTarget(msg, "default")).toBe("sharkord:default:dm:unknown");
  });
});
