import { describe, expect, it } from "vitest";
import { normalizeSharkordMessagingTarget } from "./normalize.js";

describe("normalizeSharkordMessagingTarget", () => {
  it("passes through already-qualified sharkord: targets", () => {
    expect(normalizeSharkordMessagingTarget("sharkord:myacct:channel:42")).toBe(
      "sharkord:myacct:channel:42",
    );
  });

  it("qualifies channel:N with default account", () => {
    expect(normalizeSharkordMessagingTarget("channel:123")).toBe("sharkord:default:channel:123");
  });

  it("qualifies dm:userId with default account", () => {
    expect(normalizeSharkordMessagingTarget("dm:alice")).toBe("sharkord:default:dm:alice");
  });

  it("treats bare number as channel ID", () => {
    expect(normalizeSharkordMessagingTarget("999")).toBe("sharkord:default:channel:999");
  });

  it("uses custom accountId when provided", () => {
    expect(normalizeSharkordMessagingTarget("channel:5", "prod")).toBe("sharkord:prod:channel:5");
    expect(normalizeSharkordMessagingTarget("dm:bob", "prod")).toBe("sharkord:prod:dm:bob");
    expect(normalizeSharkordMessagingTarget("42", "prod")).toBe("sharkord:prod:channel:42");
  });

  it("prefixes other strings with channel:", () => {
    expect(normalizeSharkordMessagingTarget("general")).toBe("sharkord:default:channel:general");
  });
});
