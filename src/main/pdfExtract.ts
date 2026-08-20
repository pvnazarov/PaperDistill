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

import fs from "node:fs/promises";
import path from "node:path";
// Type-only import, so this does not create a runtime cycle with the dispatcher.
import type { DocumentExtractionResult } from "./documentExtract";

const SCANNED_WARNING = "Likely a scanned PDF: little or no extractable text found. Skipped.";

const SCANNED_TOTAL_CHAR_THRESHOLD = 500;
const SCANNED_AVG_CHARS_PER_PAGE_THRESHOLD = 100;
const EXTRACTION_BACKEND = "pdfjs-dist";

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsModulePromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsModulePromise;
}

export function isLikelyScanned(characterCount: number, pageCount: number): boolean {
  const averagePerPage = pageCount > 0 ? characterCount / pageCount : 0;
  return (
    characterCount < SCANNED_TOTAL_CHAR_THRESHOLD ||
    averagePerPage < SCANNED_AVG_CHARS_PER_PAGE_THRESHOLD
  );
}

export async function extractPdfText(filePath: string): Promise<DocumentExtractionResult> {
  const pdfjsLib = await loadPdfjs();
  const fileBuffer = await fs.readFile(filePath);
  const data = new Uint8Array(fileBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    verbosity: 0,
  });

  try {
    const doc = await loadingTask.promise;
    const rawPageTexts: string[] = [];
    const markedPageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      rawPageTexts.push(pageText);
      markedPageTexts.push(`[PAGE ${pageNumber}]\n${pageText}`);
    }

    const characterCount = rawPageTexts.reduce((sum, t) => sum + t.length, 0);
    const pageCount = doc.numPages;

    return {
      fileName: path.basename(filePath),
      filePath,
      pageCount,
      characterCount,
      text: markedPageTexts.join("\n\n"),
      extractedAt: new Date().toISOString(),
      extractionBackend: EXTRACTION_BACKEND,
      noTextWarning: isLikelyScanned(characterCount, pageCount) ? SCANNED_WARNING : null,
    };
  } finally {
    await loadingTask.destroy();
  }
}
