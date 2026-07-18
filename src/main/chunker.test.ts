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
import { splitIntoChunks } from "./chunker";

describe("splitIntoChunks", () => {
  it("returns the whole text as one chunk when under the chunk size", () => {
    const text = "short text";
    const chunks = splitIntoChunks(text, { chunkSizeChars: 100, chunkOverlapChars: 10 });
    expect(chunks).toEqual([text]);
  });

  it("returns the whole text as one chunk when exactly at the chunk size", () => {
    const text = "a".repeat(50);
    const chunks = splitIntoChunks(text, { chunkSizeChars: 50, chunkOverlapChars: 5 });
    expect(chunks).toEqual([text]);
  });

  it("splits into overlapping chunks covering the entire text", () => {
    const text = "0123456789".repeat(10); // 100 chars
    const chunks = splitIntoChunks(text, { chunkSizeChars: 40, chunkOverlapChars: 10 });

    // step = 30, so starts at 0, 30, 60; the chunk starting at 60 already
    // reaches the end of the text (100 chars), so the loop stops there.
    expect(chunks).toEqual([text.slice(0, 40), text.slice(30, 70), text.slice(60, 100)]);
  });

  it("produces consecutive chunks that overlap by the requested amount", () => {
    const text = "x".repeat(100);
    const overlap = 15;
    const chunks = splitIntoChunks(text, { chunkSizeChars: 40, chunkOverlapChars: overlap });

    for (let i = 0; i < chunks.length - 1; i++) {
      const step = 40 - overlap;
      expect(chunks[i].length - step).toBe(overlap);
    }
  });

  it("covers every character of the original text with no gaps", () => {
    const text = Array.from({ length: 137 }, (_, i) => String(i % 10)).join("");
    const chunks = splitIntoChunks(text, { chunkSizeChars: 33, chunkOverlapChars: 7 });

    const step = 33 - 7;
    let expectedStart = 0;
    for (const chunk of chunks) {
      expect(text.slice(expectedStart, expectedStart + chunk.length)).toBe(chunk);
      expectedStart += step;
    }
    expect(chunks[chunks.length - 1].endsWith(text.slice(-1))).toBe(true);
  });

  it("clamps overlap that is greater than or equal to chunk size to avoid an infinite loop", () => {
    const text = "y".repeat(200);
    const chunks = splitIntoChunks(text, { chunkSizeChars: 50, chunkOverlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
  });

  it("handles a chunk size of zero or negative without hanging", () => {
    const text = "z".repeat(10);
    const chunks = splitIntoChunks(text, { chunkSizeChars: 0, chunkOverlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toContain("z");
  });
});
