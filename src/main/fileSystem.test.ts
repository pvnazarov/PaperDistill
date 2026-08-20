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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverInputFiles } from "./fileSystem";

describe("discoverInputFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperdistill-fs-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function touch(relativePath: string): Promise<void> {
    const fullPath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "");
  }

  it("finds top-level PDFs (case-insensitive extension) non-recursively by default", async () => {
    await touch("a.pdf");
    await touch("b.PDF");
    await touch("notes.txt");
    await touch("nested/c.pdf");

    const found = await discoverInputFiles(tempDir, false, ["pdf"]);

    expect(found).toHaveLength(2);
    expect(found.map((f) => path.basename(f)).sort()).toEqual(["a.pdf", "b.PDF"]);
  });

  it("finds PDFs in subdirectories when recursive is enabled", async () => {
    await touch("a.pdf");
    await touch("nested/c.pdf");
    await touch("nested/deeper/d.PDF");

    const found = await discoverInputFiles(tempDir, true, ["pdf"]);

    expect(found.map((f) => path.basename(f)).sort()).toEqual(["a.pdf", "c.pdf", "d.PDF"]);
  });

  it("returns an empty array when the folder has no PDFs", async () => {
    await touch("readme.txt");
    const found = await discoverInputFiles(tempDir, true, ["pdf"]);
    expect(found).toEqual([]);
  });

  it("ignores files whose type is not selected, regardless of recursion", async () => {
    await touch("report.docx");
    await touch("nested/data.csv");
    const found = await discoverInputFiles(tempDir, true, ["pdf"]);
    expect(found).toEqual([]);
  });

  it("finds every selected type and nothing else", async () => {
    await touch("paper.pdf");
    await touch("report.docx");
    await touch("table.xlsx");
    await touch("notes.txt");
    await touch("readme.md");
    await touch("data.csv");

    const found = await discoverInputFiles(tempDir, false, ["docx", "xlsx", "md"]);

    expect(found.map((f) => path.basename(f)).sort()).toEqual([
      "readme.md",
      "report.docx",
      "table.xlsx",
    ]);
  });

  it("matches selected extensions case-insensitively", async () => {
    await touch("Report.DOCX");
    await touch("Table.Xlsx");
    await touch("Notes.TXT");

    const found = await discoverInputFiles(tempDir, false, ["docx", "xlsx", "txt"]);

    expect(found.map((f) => path.basename(f)).sort()).toEqual([
      "Notes.TXT",
      "Report.DOCX",
      "Table.Xlsx",
    ]);
  });

  it("returns nothing when no file type is selected", async () => {
    await touch("paper.pdf");
    await touch("report.docx");

    const found = await discoverInputFiles(tempDir, true, []);

    expect(found).toEqual([]);
  });

  it("does not match a file whose name merely contains an extension", async () => {
    await touch("paper.pdf.bak");
    await touch("notes.md.old");

    const found = await discoverInputFiles(tempDir, false, ["pdf", "md"]);

    expect(found).toEqual([]);
  });
});
