import type { BridgeEvent, SharkordInboundMessage } from "./types.js";

/**
 * Normalize a bridge event into an internal inbound message.
 */
export function normalizeBridgeEvent(event: BridgeEvent): SharkordInboundMessage {
  return {
    messageId: event.messageId,
    channelId: event.channelId,
    userId: event.userId,
    userName: event.userName,
    text: event.content,
    htmlContent: event.htmlContent,
    timestamp: event.timestamp,
    isGroup: true, // Sharkord channels are group by default; DM detection TBD
    parentMessageId: event.parentMessageId,
    replyToMessageId: event.replyToMessageId,
  };
}

/**
 * Build the OpenClaw session target string from an inbound message.
 * Format: sharkord:channel:<channelId> for group, sharkord:dm:<userId> for DMs.
 */
export function buildInboundTarget(msg: SharkordInboundMessage, accountId: string): string {
  if (msg.isGroup) {
    return `sharkord:${accountId}:channel:${msg.channelId}`;
  }
  return `sharkord:${accountId}:dm:${msg.userId ?? "unknown"}`;
}
