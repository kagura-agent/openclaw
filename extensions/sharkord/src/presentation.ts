import {
  adaptMessagePresentationForChannel,
  type MessagePresentation,
} from "openclaw/plugin-sdk/interactive-runtime";

export const SHARKORD_PRESENTATION_CAPABILITIES = {
  supported: true,
  buttons: true,
  selects: false,
  context: true,
  divider: true,
  limits: {
    actions: {
      supportsStyles: true,
      supportsDisabled: true,
    },
    text: {
      markdownDialect: "html",
    },
  },
} as const;

const TONE_STYLES: Record<string, string> = {
  info: "border-left:4px solid #3b82f6;padding:8px 12px;margin:8px 0;background:#eff6ff;",
  success: "border-left:4px solid #22c55e;padding:8px 12px;margin:8px 0;background:#f0fdf4;",
  warning: "border-left:4px solid #f59e0b;padding:8px 12px;margin:8px 0;background:#fffbeb;",
  danger: "border-left:4px solid #ef4444;padding:8px 12px;margin:8px 0;background:#fef2f2;",
  neutral: "border-left:4px solid #6b7280;padding:8px 12px;margin:8px 0;background:#f9fafb;",
};

const BUTTON_STYLES: Record<string, string> = {
  primary: "background:#3b82f6;color:#fff;",
  secondary: "background:#6b7280;color:#fff;",
  success: "background:#22c55e;color:#fff;",
  danger: "background:#ef4444;color:#fff;",
};

/**
 * Render a MessagePresentation into Sharkord-compatible HTML.
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

  // Leading text (from payload.text)
  if (params.text?.trim()) {
    parts.push(`<p>${escapeHtml(params.text)}</p>`);
  }

  // Card wrapper with tone
  const tone = presentation.tone ?? "neutral";
  const wrapperStyle = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  const hasCard = presentation.title || presentation.blocks.length > 0;

  if (!hasCard) {
    return parts.join("");
  }

  const cardParts: string[] = [];

  if (presentation.title) {
    cardParts.push(`<strong>${escapeHtml(presentation.title)}</strong>`);
  }

  for (const block of presentation.blocks) {
    switch (block.type) {
      case "text":
        cardParts.push(`<p>${escapeHtml(block.text)}</p>`);
        break;
      case "context":
        cardParts.push(`<p style="font-size:0.85em;color:#6b7280;">${escapeHtml(block.text)}</p>`);
        break;
      case "divider":
        cardParts.push("<hr>");
        break;
      case "buttons":
        cardParts.push(renderButtons(block.buttons));
        break;
      case "select":
        // Fallback: render options as a list
        cardParts.push(renderSelectFallback(block));
        break;
    }
  }

  if (presentation.title || presentation.tone) {
    parts.push(`<div style="${wrapperStyle}">${cardParts.join("")}</div>`);
  } else {
    parts.push(cardParts.join(""));
  }

  return parts.join("");
}

function renderButtons(
  buttons: Array<{
    label: string;
    value?: string;
    url?: string;
    webApp?: { url: string };
    web_app?: { url: string };
    style?: string;
    disabled?: boolean;
  }>,
): string {
  const btnHtmls = buttons.map((btn) => {
    const targetUrl = btn.url ?? btn.webApp?.url ?? btn.web_app?.url;
    const style = BUTTON_STYLES[btn.style ?? "primary"] ?? BUTTON_STYLES.primary;
    const baseStyle = `${style}padding:4px 12px;border-radius:4px;text-decoration:none;display:inline-block;margin:2px 4px 2px 0;font-size:0.9em;`;

    if (btn.disabled) {
      return `<span style="${baseStyle}opacity:0.5;cursor:not-allowed;">${escapeHtml(btn.label)}</span>`;
    }
    if (targetUrl) {
      return `<a href="${escapeAttr(targetUrl)}" style="${baseStyle}" target="_blank">${escapeHtml(btn.label)}</a>`;
    }
    // Non-URL buttons rendered as styled spans (no interaction without bridge support)
    return `<span style="${baseStyle}" data-value="${escapeAttr(btn.value ?? "")}">${escapeHtml(btn.label)}</span>`;
  });

  return `<p>${btnHtmls.join("")}</p>`;
}

function renderSelectFallback(block: { placeholder?: string; options: Array<{ label: string; value: string }> }): string {
  const header = block.placeholder ? `<p style="font-size:0.85em;color:#6b7280;">${escapeHtml(block.placeholder)}</p>` : "";
  const items = block.options
    .map((opt) => `<li>${escapeHtml(opt.label)}</li>`)
    .join("");
  return `${header}<ul style="margin:4px 0;padding-left:20px;">${items}</ul>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
