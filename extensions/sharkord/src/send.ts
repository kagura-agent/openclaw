/**
 * Sharkord message sending — HTTP client to POST to bridge /send endpoint.
 */

import { normalizeSharkordMessagingTarget, extractTargetId } from "./normalize.js";
import type { SharkordSendRequest, SharkordSendResponse } from "./types.js";

export interface SharkordBridgeConfig {
  bridgeUrl: string;
  bridgeSecret: string;
}

export interface SendSharkordOptions {
  bridge?: SharkordBridgeConfig;
  replyTo?: string;
  parentMessageId?: string;
}

export interface SendSharkordResult {
  messageId: string;
  target: string;
}

let defaultBridge: SharkordBridgeConfig | undefined;

export function setDefaultBridge(bridge: SharkordBridgeConfig): void {
  defaultBridge = bridge;
}

function resolveBridge(opts: SendSharkordOptions): SharkordBridgeConfig {
  if (opts.bridge) {
    return opts.bridge;
  }
  if (defaultBridge) {
    return defaultBridge;
  }
  throw new Error("No Sharkord bridge config available — provide bridge URL and secret");
}

/**
 * Send a text message to a Sharkord channel via the bridge.
 */
export async function sendMessageSharkord(
  to: string,
  text: string,
  opts: SendSharkordOptions = {},
): Promise<SendSharkordResult> {
  const normalized = normalizeSharkordMessagingTarget(to);
  if (!normalized) {
    throw new Error(`Invalid Sharkord target: ${to}`);
  }

  const payload = text.trim();
  if (!payload) {
    throw new Error("Message must be non-empty for Sharkord sends");
  }

  const bridge = resolveBridge(opts);
  const channelId = extractTargetId(normalized);

  const body: SharkordSendRequest = {
    channelId,
    content: payload,
  };
  if (opts.replyTo) {
    body.replyTo = opts.replyTo;
  }
  if (opts.parentMessageId) {
    body.parentMessageId = opts.parentMessageId;
  }

  const url = `${bridge.bridgeUrl.replace(/\/+$/, "")}/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bridge.bridgeSecret}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sharkord bridge /send failed (${res.status}): ${errText}`);
  }

  const result = (await res.json()) as SharkordSendResponse;
  return { messageId: result.messageId, target: normalized };
}
