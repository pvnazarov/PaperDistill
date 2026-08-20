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

const PLACEHOLDER_PDF_TEXT = "{{PDF_TEXT}}";
const PLACEHOLDER_PDF_FILENAME = "{{PDF_FILENAME}}";
const PLACEHOLDER_PDF_PATH = "{{PDF_PATH}}";
const PLACEHOLDER_PAGE_COUNT = "{{PAGE_COUNT}}";

export interface PromptBuilderInput {
  promptTemplate: string;
  pdfText: string;
  pdfFileName: string;
  pdfPath: string;
  /** Null for formats without pages; rendered as "unknown". */
  pageCount: number | null;
}

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

export function buildPrompt(input: PromptBuilderInput): string {
  const hasPdfTextPlaceholder = input.promptTemplate.includes(PLACEHOLDER_PDF_TEXT);

  let result = input.promptTemplate;
  result = replaceAll(result, PLACEHOLDER_PDF_FILENAME, input.pdfFileName);
  result = replaceAll(result, PLACEHOLDER_PDF_PATH, input.pdfPath);
  result = replaceAll(
    result,
    PLACEHOLDER_PAGE_COUNT,
    input.pageCount === null ? "unknown" : String(input.pageCount),
  );

  if (hasPdfTextPlaceholder) {
    return replaceAll(result, PLACEHOLDER_PDF_TEXT, input.pdfText);
  }

  return `${result}\n\n---\n\nPDF FILE:\n${input.pdfFileName}\n\nEXTRACTED PDF TEXT:\n${input.pdfText}`;
}
