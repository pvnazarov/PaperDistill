/*
 * PaperDistill
 * Copyright (c) 2026 Petr Nazarov, Luxembourg Institute of Health (LIH)
 *
 * Released under the MIT License.
 * Developed with significant assistance from Anthropic Claude Code.
 * Responsibility for any bugs remains under active investigation.
 *
 * See LICENSE for details.
 */

import { describe, expect, it } from "vitest";
import { buildPrompt } from "./promptBuilder";

describe("buildPrompt", () => {
  it("replaces {{PDF_TEXT}} in place when present", () => {
    const result = buildPrompt({
      promptTemplate: "Extract data from:\n{{PDF_TEXT}}\nEnd.",
      pdfText: "[PAGE 1]\nSome extracted text.",
      pdfFileName: "paper.pdf",
      pdfPath: "/papers/paper.pdf",
      pageCount: 1,
    });

    expect(result).toBe("Extract data from:\n[PAGE 1]\nSome extracted text.\nEnd.");
  });

  it("replaces every occurrence of {{PDF_TEXT}}", () => {
    const result = buildPrompt({
      promptTemplate: "A: {{PDF_TEXT}} B: {{PDF_TEXT}}",
      pdfText: "X",
      pdfFileName: "paper.pdf",
      pdfPath: "/papers/paper.pdf",
      pageCount: 1,
    });

    expect(result).toBe("A: X B: X");
  });

  it("appends a delimited section when {{PDF_TEXT}} is absent", () => {
    const result = buildPrompt({
      promptTemplate: "Extract the title and authors.",
      pdfText: "[PAGE 1]\nSome extracted text.",
      pdfFileName: "paper.pdf",
      pdfPath: "/papers/paper.pdf",
      pageCount: 1,
    });

    expect(result).toBe(
      [
        "Extract the title and authors.",
        "",
        "---",
        "",
        "PDF FILE:",
        "paper.pdf",
        "",
        "EXTRACTED PDF TEXT:",
        "[PAGE 1]\nSome extracted text.",
      ].join("\n"),
    );
  });

  it("replaces {{PDF_FILENAME}}, {{PDF_PATH}}, and {{PAGE_COUNT}}", () => {
    const result = buildPrompt({
      promptTemplate:
        "File: {{PDF_FILENAME}} Path: {{PDF_PATH}} Pages: {{PAGE_COUNT}} Text: {{PDF_TEXT}}",
      pdfText: "irrelevant",
      pdfFileName: "paper.pdf",
      pdfPath: "/papers/paper.pdf",
      pageCount: 12,
    });

    expect(result).toBe("File: paper.pdf Path: /papers/paper.pdf Pages: 12 Text: irrelevant");
  });

  it("replaces metadata placeholders even when using the append fallback", () => {
    const result = buildPrompt({
      promptTemplate: "Analyze {{PDF_FILENAME}} ({{PAGE_COUNT}} pages).",
      pdfText: "body text",
      pdfFileName: "paper.pdf",
      pdfPath: "/papers/paper.pdf",
      pageCount: 3,
    });

    expect(result.startsWith("Analyze paper.pdf (3 pages).")).toBe(true);
    expect(result).toContain("EXTRACTED PDF TEXT:\nbody text");
  });
});
