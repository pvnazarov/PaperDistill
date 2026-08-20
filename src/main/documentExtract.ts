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
import mammoth from "mammoth";
import { extractPdfText } from "./pdfExtract";
import { extractXlsxText } from "./xlsxExtract";

export interface DocumentExtractionResult {
  fileName: string;
  filePath: string;
  /** Null for formats without pages: DOCX, XLSX, TXT and MD. */
  pageCount: number | null;
  characterCount: number;
  text: string;
  extractedAt: string;
  extractionBackend: string;
  /**
   * Set when there is too little text to send to the LLM — a likely-scanned PDF,
   * or any other file that yielded nothing. The file is reported and skipped.
   */
  noTextWarning: string | null;
}

const EMPTY_TEXT_WARNING = "No extractable text found in this file. Skipped.";

/** Builds a result for the formats that have no notion of a page. */
function nonPaginatedResult(
  filePath: string,
  rawText: string,
  extractionBackend: string,
): DocumentExtractionResult {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  return {
    fileName: path.basename(filePath),
    filePath,
    pageCount: null,
    characterCount: text.length,
    text,
    extractedAt: new Date().toISOString(),
    extractionBackend,
    noTextWarning: text.length === 0 ? EMPTY_TEXT_WARNING : null,
  };
}

async function extractDocx(filePath: string): Promise<DocumentExtractionResult> {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return nonPaginatedResult(filePath, value, "mammoth");
}

async function extractXlsx(filePath: string): Promise<DocumentExtractionResult> {
  const buffer = await fs.readFile(filePath);
  const text = await extractXlsxText(buffer);
  return nonPaginatedResult(filePath, text, "jszip");
}

async function extractPlainText(filePath: string): Promise<DocumentExtractionResult> {
  const raw = await fs.readFile(filePath, "utf-8");
  return nonPaginatedResult(filePath, raw.replace(/^﻿/, ""), "utf-8");
}

/** Extracts text from any of the file types the Input Folder checkboxes offer. */
export async function extractDocumentText(filePath: string): Promise<DocumentExtractionResult> {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  switch (extension) {
    case "pdf":
      return extractPdfText(filePath);
    case "docx":
      return extractDocx(filePath);
    case "xlsx":
      return extractXlsx(filePath);
    case "txt":
    case "md":
      return extractPlainText(filePath);
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}
