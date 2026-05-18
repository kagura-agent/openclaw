import { describe, it, expect } from "vitest";
import {
  SHARKORD_PRESENTATION_CAPABILITIES,
  renderPresentationHtml,
} from "./presentation.js";
import type { MessagePresentation } from "openclaw/plugin-sdk/interactive-runtime";

describe("SHARKORD_PRESENTATION_CAPABILITIES", () => {
  it("declares supported capabilities", () => {
    expect(SHARKORD_PRESENTATION_CAPABILITIES.supported).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.buttons).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.selects).toBe(false);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.context).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.divider).toBe(true);
  });
});

describe("renderPresentationHtml", () => {
  it("renders text blocks as <p> tags", () => {
    const presentation: MessagePresentation = {
      blocks: [{ type: "text", text: "Hello world" }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("<p>Hello world</p>");
  });

  it("renders context blocks with subtle styling", () => {
    const presentation: MessagePresentation = {
      blocks: [{ type: "context", text: "Last updated 5m ago" }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("font-size:0.85em");
    expect(html).toContain("Last updated 5m ago");
  });

  it("renders dividers as <hr>", () => {
    const presentation: MessagePresentation = {
      blocks: [{ type: "divider" }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("<hr>");
  });

  it("renders URL buttons as <a> links", () => {
    const presentation: MessagePresentation = {
      blocks: [
        {
          type: "buttons",
          buttons: [
            { label: "Open Docs", url: "https://example.com/docs" },
          ],
        },
      ],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain("Open Docs");
  });

  it("renders action buttons without URL as styled spans", () => {
    const presentation: MessagePresentation = {
      blocks: [
        {
          type: "buttons",
          buttons: [{ label: "Approve", value: "approve" }],
        },
      ],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("<span");
    expect(html).toContain("Approve");
    expect(html).not.toContain("<a ");
  });

  it("renders select blocks as text fallback (selects not supported)", () => {
    const presentation: MessagePresentation = {
      blocks: [
        {
          type: "select",
          placeholder: "Pick one",
          options: [
            { label: "Option A", value: "a" },
            { label: "Option B", value: "b" },
          ],
        },
      ],
    };
    const html = renderPresentationHtml({ presentation });
    // selects: false means adaptMessagePresentationForChannel degrades to context text
    expect(html).toContain("Pick one");
    expect(html).toContain("Option A");
    expect(html).toContain("Option B");
  });

  it("wraps content in card div with tone styling", () => {
    const presentation: MessagePresentation = {
      title: "Status Update",
      tone: "success",
      blocks: [{ type: "text", text: "All systems go" }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("<strong>Status Update</strong>");
    expect(html).toContain("#22c55e"); // success green
    expect(html).toContain("All systems go");
  });

  it("renders danger tone", () => {
    const presentation: MessagePresentation = {
      tone: "danger",
      blocks: [{ type: "text", text: "Error occurred" }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain("#ef4444"); // danger red
  });

  it("prepends leading text before presentation blocks", () => {
    const presentation: MessagePresentation = {
      blocks: [{ type: "text", text: "Block text" }],
    };
    const html = renderPresentationHtml({ presentation, text: "Leading text" });
    const leadingIdx = html.indexOf("Leading text");
    const blockIdx = html.indexOf("Block text");
    expect(leadingIdx).toBeLessThan(blockIdx);
  });

  it("escapes HTML in text content", () => {
    const presentation: MessagePresentation = {
      blocks: [{ type: "text", text: '<script>alert("xss")</script>' }],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles empty blocks array", () => {
    const presentation: MessagePresentation = { blocks: [] };
    const html = renderPresentationHtml({ presentation });
    // Should not throw, may be empty
    expect(typeof html).toBe("string");
  });

  it("renders webApp buttons as links", () => {
    const presentation: MessagePresentation = {
      blocks: [
        {
          type: "buttons",
          buttons: [
            { label: "Open App", webApp: { url: "https://app.example.com" } },
          ],
        },
      ],
    };
    const html = renderPresentationHtml({ presentation });
    expect(html).toContain('href="https://app.example.com"');
    expect(html).toContain("Open App");
  });

  it("renders multiple blocks in order", () => {
    const presentation: MessagePresentation = {
      blocks: [
        { type: "text", text: "First" },
        { type: "divider" },
        { type: "context", text: "Footer" },
      ],
    };
    const html = renderPresentationHtml({ presentation });
    const firstIdx = html.indexOf("First");
    const hrIdx = html.indexOf("<hr>");
    const footerIdx = html.indexOf("Footer");
    expect(firstIdx).toBeLessThan(hrIdx);
    expect(hrIdx).toBeLessThan(footerIdx);
  });
});
