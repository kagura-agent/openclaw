import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { afterEach, describe, expect, test } from "vitest";
import {
  captureCompactionCheckpointSnapshot,
  cleanupCompactionCheckpointSnapshot,
  discoverCheckpointFilesFromDisk,
} from "./session-compaction-checkpoints.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("session-compaction-checkpoints", () => {
  test("capture stores the copied pre-compaction transcript path and cleanup removes only the copy", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-checkpoint-"));
    tempDirs.push(dir);

    const session = SessionManager.create(dir, dir);
    const userMessage: UserMessage = {
      role: "user",
      content: "before compaction",
      timestamp: Date.now(),
    };
    const assistantMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "working on it" }],
      api: "responses",
      provider: "openai",
      model: "gpt-test",
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };
    session.appendMessage(userMessage);
    session.appendMessage(assistantMessage);

    const sessionFile = session.getSessionFile();
    const leafId = session.getLeafId();
    expect(sessionFile).toBeTruthy();
    expect(leafId).toBeTruthy();

    const originalBefore = await fs.readFile(sessionFile!, "utf-8");
    const snapshot = captureCompactionCheckpointSnapshot({
      sessionManager: session,
      sessionFile: sessionFile!,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.leafId).toBe(leafId);
    expect(snapshot?.sessionFile).not.toBe(sessionFile);
    expect(snapshot?.sessionFile).toContain(".checkpoint.");
    expect(fsSync.existsSync(snapshot!.sessionFile)).toBe(true);
    expect(await fs.readFile(snapshot!.sessionFile, "utf-8")).toBe(originalBefore);

    session.appendCompaction("checkpoint summary", leafId!, 123, { ok: true });

    expect(await fs.readFile(snapshot!.sessionFile, "utf-8")).toBe(originalBefore);
    expect(await fs.readFile(sessionFile!, "utf-8")).not.toBe(originalBefore);

    await cleanupCompactionCheckpointSnapshot(snapshot);

    expect(fsSync.existsSync(snapshot!.sessionFile)).toBe(false);
    expect(fsSync.existsSync(sessionFile!)).toBe(true);
  });

  test("discoverCheckpointFilesFromDisk finds checkpoint files by naming convention", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-checkpoint-discover-"));
    tempDirs.push(dir);

    const sessionFile = path.join(dir, "abc123.jsonl");
    await fs.writeFile(sessionFile, "{}");

    // Create checkpoint files matching the naming convention
    const cp1 = path.join(dir, "abc123.checkpoint.uuid-1111.jsonl");
    const cp2 = path.join(dir, "abc123.checkpoint.uuid-2222.jsonl");
    const unrelated = path.join(dir, "other-session.checkpoint.uuid-3333.jsonl");
    await fs.writeFile(cp1, "{}");
    // Small delay so mtimes differ
    await new Promise((r) => setTimeout(r, 50));
    await fs.writeFile(cp2, "{}");
    await fs.writeFile(unrelated, "{}");

    const discovered = discoverCheckpointFilesFromDisk(sessionFile, "agent:main:main", "sid-1");

    expect(discovered).toHaveLength(2);
    expect(discovered.map((c) => c.checkpointId).toSorted()).toEqual(["uuid-1111", "uuid-2222"]);
    expect(discovered[0].sessionKey).toBe("agent:main:main");
    expect(discovered[0].sessionId).toBe("sid-1");
    expect(discovered[0].preCompaction.sessionFile).toBeTruthy();
    // Should be sorted newest first
    expect(discovered[0].createdAt).toBeGreaterThanOrEqual(discovered[1].createdAt);
  });

  test("discoverCheckpointFilesFromDisk returns empty for missing sessionFile", () => {
    expect(discoverCheckpointFilesFromDisk(undefined, "k", "s")).toEqual([]);
    expect(discoverCheckpointFilesFromDisk("", "k", "s")).toEqual([]);
  });

  test("discoverCheckpointFilesFromDisk returns empty when no checkpoint files exist", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-checkpoint-empty-"));
    tempDirs.push(dir);
    const sessionFile = path.join(dir, "session.jsonl");
    await fs.writeFile(sessionFile, "{}");
    expect(discoverCheckpointFilesFromDisk(sessionFile, "k", "s")).toEqual([]);
  });
});
