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

export interface ChunkOptions {
  chunkSizeChars: number;
  chunkOverlapChars: number;
}

export function splitIntoChunks(text: string, options: ChunkOptions): string[] {
  const chunkSizeChars = Math.max(1, options.chunkSizeChars);
  const chunkOverlapChars = Math.max(0, Math.min(options.chunkOverlapChars, chunkSizeChars - 1));

  if (text.length <= chunkSizeChars) {
    return [text];
  }

  const step = chunkSizeChars - chunkOverlapChars;
  const chunks: string[] = [];

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + chunkSizeChars, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
  }

  return chunks;
}
