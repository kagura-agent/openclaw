import type { BridgeSendRequest, BridgeSendResponse } from "./types.js";

/**
 * Send a message to Sharkord via the bridge plugin's /send endpoint.
 */
export async function sendMessageSharkord(
  bridgeUrl: string,
  bridgeSecret: string | undefined,
  request: BridgeSendRequest,
): Promise<BridgeSendResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (bridgeSecret) {
    headers["Authorization"] = `Bearer ${bridgeSecret}`;
  }

  const res = await fetch(`${bridgeUrl}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bridge /send failed: ${res.status} ${body}`);
  }

  return (await res.json()) as BridgeSendResponse;
}

/**
 * Send a text message to a Sharkord channel, returning the message ID.
 * Wraps plain text in <p> tags for HTML content.
 */
export async function sendTextToSharkord(
  target: string,
  text: string,
  opts: {
    bridgeUrl: string;
    bridgeSecret?: string;
    accountId?: string;
    replyTo?: string;
    parentMessageId?: string;
  },
): Promise<{ messageId: string; target: string }> {
  // Parse channelId from target string (sharkord:<accountId>:channel:<channelId>)
  const parts = target.split(":");
  const channelId = parseInt(parts[parts.length - 1] ?? "0", 10);

  // Wrap plain text in paragraph tags for HTML
  const htmlContent = `<p>${escapeHtml(text)}</p>`;

  const result = await sendMessageSharkord(opts.bridgeUrl, opts.bridgeSecret, {
    channelId,
    content: htmlContent,
    replyTo: opts.replyTo,
    parentMessageId: opts.parentMessageId,
  });

  return { messageId: result.messageId, target };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
