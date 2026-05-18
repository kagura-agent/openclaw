import { describe, it, expect } from "vitest";
import { renderPresentationHtml, SHARKORD_PRESENTATION_CAPABILITIES } from "./presentation.js";

describe("SHARKORD_PRESENTATION_CAPABILITIES", () => {
  it("declares supported features", () => {
    expect(SHARKORD_PRESENTATION_CAPABILITIES.supported).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.buttons).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.selects).toBe(false);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.context).toBe(true);
    expect(SHARKORD_PRESENTATION_CAPABILITIES.divider).toBe(true);
  });
});

describe("renderPresentationHtml", () => {
  it("renders text blocks", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [{ type: "text", text: "Hello world" }],
      },
    });
    expect(html).toContain("<p>Hello world</p>");
  });

  it("renders context blocks with small styling", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [{ type: "context", text: "Footer text" }],
      },
    });
    expect(html).toContain("font-size:0.85em");
    expect(html).toContain("Footer text");
  });

  it("renders divider as hr", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [{ type: "divider" }],
      },
    });
    expect(html).toContain("<hr>");
  });

  it("renders URL buttons as links", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "buttons",
            buttons: [{ label: "Click me", url: "https://example.com" }],
          },
        ],
      },
    });
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("Click me");
    expect(html).toContain("target=\"_blank\"");
  });

  it("renders disabled buttons with opacity", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "buttons",
            buttons: [{ label: "Disabled", disabled: true }],
          },
        ],
      },
    });
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("cursor:not-allowed");
    expect(html).toContain("<span");
    expect(html).not.toContain("<a ");
  });

  it("renders non-URL buttons as styled spans with data-value", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "buttons",
            buttons: [{ label: "Action", value: "do_action", style: "success" }],
          },
        ],
      },
    });
    expect(html).toContain('data-value="do_action"');
    expect(html).toContain("Action");
    expect(html).toContain("background:#22c55e");
  });

  it("renders title with card wrapper", () => {
    const html = renderPresentationHtml({
      presentation: {
        title: "My Card",
        blocks: [{ type: "text", text: "Content" }],
      },
    });
    expect(html).toContain("<strong>My Card</strong>");
    expect(html).toContain("<div style=");
  });

  it("applies tone styling to card wrapper", () => {
    const html = renderPresentationHtml({
      presentation: {
        title: "Warning",
        tone: "warning",
        blocks: [{ type: "text", text: "Be careful" }],
      },
    });
    expect(html).toContain("border-left:4px solid #f59e0b");
    expect(html).toContain("background:#fffbeb");
  });

  it("renders danger tone", () => {
    const html = renderPresentationHtml({
      presentation: {
        tone: "danger",
        blocks: [{ type: "text", text: "Error" }],
      },
    });
    expect(html).toContain("border-left:4px solid #ef4444");
  });

  it("includes leading text from payload", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [{ type: "text", text: "Card content" }],
      },
      text: "Leading message",
    });
    expect(html).toContain("<p>Leading message</p>");
    expect(html).toContain("Card content");
  });

  it("returns empty string for empty presentation without text", () => {
    const html = renderPresentationHtml({
      presentation: { blocks: [] },
    });
    expect(html).toBe("");
  });

  it("escapes HTML in text content", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [{ type: "text", text: "<script>alert('xss')</script>" }],
      },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in button URLs", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "buttons",
            buttons: [{ label: "Link", url: 'https://example.com/"onclick="alert(1)' }],
          },
        ],
      },
    });
    expect(html).not.toContain('"onclick="');
    expect(html).toContain("&quot;onclick=");
  });

  it("renders select as text fallback (selects: false triggers SDK conversion)", () => {
    // Since we declare selects: false, adaptMessagePresentationForChannel
    // converts select blocks to context text before our renderer sees them
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "select",
            placeholder: "Choose one",
            options: [
              { label: "Option A", value: "a" },
              { label: "Option B", value: "b" },
            ],
          },
        ],
      },
    });
    // The SDK converts to a context/text block with the options listed
    expect(html).toContain("Choose one");
    expect(html).toContain("Option A");
    expect(html).toContain("Option B");
  });

  it("renders webApp buttons as links", () => {
    const html = renderPresentationHtml({
      presentation: {
        blocks: [
          {
            type: "buttons",
            buttons: [{ label: "Web App", webApp: { url: "https://app.example.com" } }],
          },
        ],
      },
    });
    expect(html).toContain('href="https://app.example.com"');
  });

  it("renders multiple blocks in order", () => {
    const html = renderPresentationHtml({
      presentation: {
        title: "Status",
        tone: "success",
        blocks: [
          { type: "text", text: "All good" },
          { type: "divider" },
          { type: "context", text: "Updated just now" },
        ],
      },
    });
    const textIdx = html.indexOf("All good");
    const hrIdx = html.indexOf("<hr>");
    const ctxIdx = html.indexOf("Updated just now");
    expect(textIdx).toBeLessThan(hrIdx);
    expect(hrIdx).toBeLessThan(ctxIdx);
  });
});
