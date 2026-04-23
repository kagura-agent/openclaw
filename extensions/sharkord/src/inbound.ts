/**
 * Sharkord inbound — normalize bridge events into OpenClaw inbound context.
 */

import type { SharkordBridgeEvent, SharkordInboundMessage } from "./types.js";

/**
 * Convert a raw bridge event into a normalized inbound message.
 */
export function normalizeBridgeEvent(event: SharkordBridgeEvent): SharkordInboundMessage {
  // Treat all bridge messages as group (channel) messages by default.
  // DM detection would require the bridge to signal it; extend later.
  const isDm = event.channelId.startsWith("dm:");

  return {
    messageId: event.messageId,
    channelId: isDm ? event.channelId.slice("dm:".length) : event.channelId,
    userId: event.userId,
    text: event.content,
    htmlContent: event.htmlContent,
    timestamp: event.timestamp,
    isGroup: !isDm,
  };
}

/**
 * Build the OpenClaw target string for routing.
 */
export function buildInboundTarget(msg: SharkordInboundMessage): string {
  if (msg.isGroup) {
    return `sharkord:${msg.channelId}`;
  }
  return `sharkord:dm:${msg.userId}`;
}
