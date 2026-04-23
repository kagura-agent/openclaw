import type { OpenClawConfig } from "./runtime-api.js";

// ─── Bridge Event Payloads ───

export interface SharkordBridgeEvent {
  type: "message:created";
  messageId: string;
  channelId: string;
  userId: string;
  content: string;
  htmlContent?: string;
  timestamp: number;
}

// ─── Bridge Send Request/Response ───

export interface SharkordSendRequest {
  channelId: string;
  content: string;
  replyTo?: string;
  parentMessageId?: string;
}

export interface SharkordSendResponse {
  messageId: string;
}

// ─── Inbound Message ───

export interface SharkordInboundMessage {
  messageId: string;
  channelId: string;
  userId: string;
  text: string;
  htmlContent?: string;
  timestamp: number;
  isGroup: boolean;
}

// ─── Config ───

export interface SharkordChannelConfig {
  bridgeUrl?: string;
  bridgeSecret?: string;
  listenPort?: number;
}

export type CoreConfig = OpenClawConfig & {
  channels?: OpenClawConfig["channels"] & {
    sharkord?: SharkordChannelConfig;
  };
};
