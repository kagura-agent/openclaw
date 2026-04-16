import { describe, expect, it, vi } from "vitest";

vi.mock("./bundled-channel-catalog-read.js", () => ({
  listBundledChannelCatalogEntries: () => [
    {
      id: "QQ",
      aliases: [],
      order: 0,
      channel: { label: "QQ Messenger", blurb: "QQ channel" },
    },
    {
      id: "telegram",
      aliases: ["tg"],
      order: 1,
      channel: { label: "Telegram", blurb: "Telegram channel" },
    },
  ],
}));

vi.mock("./ids.js", () => ({
  CHAT_CHANNEL_ORDER: ["qq", "telegram"],
}));

vi.mock("./plugins/exposure.js", () => ({
  resolveChannelExposure: () => "public",
}));

describe("buildChatChannelMetaById", () => {
  it("normalizes mixed-case channel IDs to lowercase to match CHAT_CHANNEL_ORDER", async () => {
    const { buildChatChannelMetaById } = await import("./chat-meta-shared.js");
    const meta = buildChatChannelMetaById();

    expect(meta["qq"]).toBeDefined();
    expect(meta["qq"].label).toBe("QQ Messenger");
    expect(meta["telegram"]).toBeDefined();
  });
});

describe("listChatChannels", () => {
  it("returns no undefined entries even if meta map has gaps", async () => {
    const { listChatChannels } = await import("./chat-meta.js");
    const channels = listChatChannels();

    expect(channels.every(Boolean)).toBe(true);
  });
});
