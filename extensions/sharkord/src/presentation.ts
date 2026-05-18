import {
  adaptMessagePresentationForChannel,
  type MessagePresentation,
} from "openclaw/plugin-sdk/interactive-runtime";
import type { ChannelOutboundAdapter } from "./runtime-api.js";

/**
 * Sharkord renders HTML, so we can support text, context, dividers, and
 * URL-based buttons natively. Action buttons (with value but no URL) and
 * selects degrade to text since Sharkord has no interaction callback path yet.
 */
export const SHARKORD_PRESENTATION_CAPABILITIES = {
  supported: true,
  buttons: true,
  selects: false,
  context: true,
  divider: true,
  limits: {
    actions: {
      supportsStyles: false,
      supportsDisabled: false,
    },
    text: {
      markdownDialect: "html",
    },
  },
} satisfies ChannelOutboundAdapter["presentationCapabilities"];

const TONE_STYLES: Record<string, string> = {
  info: "border-left:4px solid #3b82f6;padding:8px 12px;margin:8px 0;background:#eff6ff;",
  success: "border-left:4px solid #22c55e;padding:8px 12px;margin:8px 0;background:#f0fdf4;",
  warning: "border-left:4px solid #eab308;padding:8px 12px;margin:8px 0;background:#fefce8;",
  danger: "border-left:4px solid #ef4444;padding:8px 12px;margin:8px 0;background:#fef2f2;",
  neutral: "border-left:4px solid #9ca3af;padding:8px 12px;margin:8px 0;background:#f9fafb;",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render an adapted presentation into Sharkord HTML.
 */
export function renderPresentationHtml(params: {
  presentation: MessagePresentation;
  text?: string | null;
}): string {
  const presentation = adaptMessagePresentationForChannel({
    presentation: params.presentation,
    capabilities: SHARKORD_PRESENTATION_CAPABILITIES,
  });

  const parts: string[] = [];

  // Leading text (the plain message body, if any)
  const text = params.text?.trim();
  if (text) {
    parts.push(`<p>${escapeHtml(text)}</p>`);
  }

  // Card wrapper: title + tone
  const hasCard = presentation.title || presentation.tone;
  const toneStyle = presentation.tone ? TONE_STYLES[presentation.tone] ?? "" : "";

  if (hasCard) {
    parts.push(`<div style="${toneStyle || "padding:8px 12px;margin:8px 0;"}">`);
    if (presentation.title) {
      parts.push(`<p><strong>${escapeHtml(presentation.title)}</strong></p>`);
    }
  }

  for (const block of presentation.blocks) {
    switch (block.type) {
      case "text":
        parts.push(`<p>${escapeHtml(block.text)}</p>`);
        break;

      case "context":
        parts.push(
          `<p style="font-size:0.85em;color:#6b7280;">${escapeHtml(block.text)}</p>`,
        );
        break;

      case "divider":
        parts.push("<hr>");
        break;

      case "buttons": {
        const buttonHtmls = block.buttons.map((btn) => {
          const targetUrl = btn.url ?? btn.webApp?.url ?? btn.web_app?.url;
          if (targetUrl) {
            return `<a href="${escapeHtml(targetUrl)}" style="display:inline-block;padding:4px 12px;margin:2px 4px;border:1px solid #d1d5db;border-radius:4px;text-decoration:none;color:#1d4ed8;">${escapeHtml(btn.label)}</a>`;
          }
          // Action button without URL — render as styled span (no interaction support yet)
          return `<span style="display:inline-block;padding:4px 12px;margin:2px 4px;border:1px solid #d1d5db;border-radius:4px;color:#374151;">${escapeHtml(btn.label)}</span>`;
        });
        if (buttonHtmls.length > 0) {
          parts.push(`<p>${buttonHtmls.join(" ")}</p>`);
        }
        break;
      }

      case "select": {
        // No native select support — render as list
        const heading = block.placeholder
          ? `<p><em>${escapeHtml(block.placeholder)}:</em></p>`
          : "";
        const items = block.options
          .map((opt) => `<li>${escapeHtml(opt.label)}</li>`)
          .join("");
        if (items) {
          parts.push(`${heading}<ul>${items}</ul>`);
        }
        break;
      }
    }
  }

  if (hasCard) {
    parts.push("</div>");
  }

  return parts.join("\n");
}
