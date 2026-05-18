import { sanitizeForPlainText } from "openclaw/plugin-sdk/outbound-runtime";
import { SHARKORD_PRESENTATION_CAPABILITIES, renderPresentationHtml } from "./presentation.js";
import type { MessagePresentation } from "openclaw/plugin-sdk/interactive-runtime";

export const sharkordOutboundBaseAdapter = {
  deliveryMode: "direct" as const,
  chunkerMode: "markdown" as const,
  textChunkLimit: 4000,
  sanitizeText: ({ text }: { text: string }) => sanitizeForPlainText(text),
  presentationCapabilities: SHARKORD_PRESENTATION_CAPABILITIES,
  renderPresentation: ({
    payload,
    presentation,
  }: {
    payload: { text?: string | null; mediaUrl?: string; mediaUrls?: string[] };
    presentation: MessagePresentation;
  }) => {
    // Skip presentation rendering for media messages
    if (payload.mediaUrl || payload.mediaUrls?.length) {
      return null;
    }
    const html = renderPresentationHtml({ presentation, text: payload.text });
    return {
      ...payload,
      text: html,
    };
  },
};
