import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.mock("./pdfExtract", () => ({
  extractPdfText: vi.fn(),
}));

import { extractPdfText } from "./pdfExtract";
import type { PdfExtractionResult } from "./pdfExtract";
import { outputPathFor, runBatch } from "./batchRunner";
import type { StartBatchOptions } from "../shared/types";

const mockExtract = vi.mocked(extractPdfText);

function extraction(overrides: Partial<PdfExtractionResult> = {}): PdfExtractionResult {
  return {
    fileName: "paper.pdf",
    filePath: "paper.pdf",
    pageCount: 1,
    characterCount: 2000,
    text: "[PAGE 1]\nSome real extracted text.",
    extractedAt: new Date().toISOString(),
    extractionBackend: "pdfjs-dist",
    likelyScanned: false,
    ...overrides,
  };
}

function fakeProvider(text = "# Generated Markdown") {
  return { generateMarkdown: vi.fn().mockResolvedValue({ text }) };
}

describe("outputPathFor", () => {
  it("generates <stem>.md preserving the original stem, including spaces and parentheses", () => {
    const result = outputPathFor("/out", "/pdfs/Despotovic(2024)Heliyon.pdf");
    expect(result).toBe(path.join("/out", "Despotovic(2024)Heliyon.md"));
  });
});

describe("runBatch", () => {
  let tempDir: string;
  let promptFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperdistill-batch-"));
    promptFilePath = path.join(tempDir, "prompt.txt");
    await fs.writeFile(promptFilePath, "Summarize.\n\n{{PDF_TEXT}}", "utf-8");
    mockExtract.mockReset();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function baseOptions(overrides: Partial<StartBatchOptions> = {}): StartBatchOptions {
    return {
      filePaths: [],
      promptFilePath,
      outputFolder: tempDir,
      providerConfig: { providerName: "anthropic", model: "m" },
      overwrite: false,
      resumeMode: false,
      writeFailureFiles: false,
      addYamlHeader: false,
      maxInputChars: 180000,
      chunkSizeChars: 70000,
      chunkOverlapChars: 5000,
      ...overrides,
    };
  }

  it("writes output to <stem>.md and leaves no .tmp file behind (atomic write)", async () => {
    const pdfPath = path.join(tempDir, "MyPaper (2024).pdf");
    mockExtract.mockResolvedValue(extraction({ fileName: "MyPaper (2024).pdf", filePath: pdfPath }));
    const provider = fakeProvider("# Result");

    const [job] = await runBatch(baseOptions({ filePaths: [pdfPath] }), {
      createProvider: () => provider,
      providerName: "mock",
      model: "m",
      onProgress: () => {},
    });

    expect(job.status).toBe("success");
    expect(job.outputPath).toBe(path.join(tempDir, "MyPaper (2024).md"));
    expect(await fs.readFile(job.outputPath as string, "utf-8")).toBe("# Result");

    const files = await fs.readdir(tempDir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("does not stop the queue when one PDF fails, and still writes output for the rest", async () => {
    const pdfPaths = ["a.pdf", "b.pdf", "c.pdf"].map((f) => path.join(tempDir, f));
    mockExtract
      .mockResolvedValueOnce(extraction({ fileName: "a.pdf", filePath: pdfPaths[0] }))
      .mockRejectedValueOnce(new Error("Invalid PDF structure."))
      .mockResolvedValueOnce(extraction({ fileName: "c.pdf", filePath: pdfPaths[2] }));

    const provider = fakeProvider();
    const jobs = await runBatch(baseOptions({ filePaths: pdfPaths }), {
      createProvider: () => provider,
      providerName: "mock",
      model: "m",
      onProgress: () => {},
    });

    expect(jobs.map((j) => j.status)).toEqual(["success", "failed", "success"]);
    expect(jobs[1].errorMessage).toBe("Invalid PDF structure.");
    expect(provider.generateMarkdown).toHaveBeenCalledTimes(2);
  });

  it("marks a likely-scanned PDF as a warning and skips the LLM call", async () => {
    const pdfPath = path.join(tempDir, "scanned.pdf");
    mockExtract.mockResolvedValue(
      extraction({ fileName: "scanned.pdf", filePath: pdfPath, characterCount: 0, text: "[PAGE 1]\n", likelyScanned: true }),
    );
    const provider = fakeProvider();

    const [job] = await runBatch(baseOptions({ filePaths: [pdfPath] }), {
      createProvider: () => provider,
      providerName: "mock",
      model: "m",
      onProgress: () => {},
    });

    expect(job.status).toBe("warning");
    expect(job.outputPath).toBeNull();
    expect(provider.generateMarkdown).not.toHaveBeenCalled();
  });

  it("skips a PDF whose output already exists when overwrite is off (default)", async () => {
    const pdfPath = path.join(tempDir, "done.pdf");
    await fs.writeFile(path.join(tempDir, "done.md"), "old content", "utf-8");
    mockExtract.mockResolvedValue(extraction({ fileName: "done.pdf", filePath: pdfPath }));
    const provider = fakeProvider("new content");

    const [job] = await runBatch(baseOptions({ filePaths: [pdfPath], overwrite: false, resumeMode: false }), {
      createProvider: () => provider,
      providerName: "mock",
      model: "m",
      onProgress: () => {},
    });

    expect(job.status).toBe("skipped");
    expect(provider.generateMarkdown).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(tempDir, "done.md"), "utf-8")).toBe("old content");
  });

  it("skips a PDF whose output already exists in resume mode, even if overwrite is on", async () => {
    const pdfPath = path.join(tempDir, "done.pdf");
    await fs.writeFile(path.join(tempDir, "done.md"), "old content", "utf-8");
    mockExtract.mockResolvedValue(extraction({ fileName: "done.pdf", filePath: pdfPath }));
    const provider = fakeProvider("new content");

    const [job] = await runBatch(
      baseOptions({ filePaths: [pdfPath], overwrite: true, resumeMode: true }),
      { createProvider: () => provider, providerName: "mock", model: "m", onProgress: () => {} },
    );

    expect(job.status).toBe("skipped");
    expect(provider.generateMarkdown).not.toHaveBeenCalled();
  });

  it("reprocesses and overwrites existing output when overwrite is on and resume is off", async () => {
    const pdfPath = path.join(tempDir, "done.pdf");
    await fs.writeFile(path.join(tempDir, "done.md"), "old content", "utf-8");
    mockExtract.mockResolvedValue(extraction({ fileName: "done.pdf", filePath: pdfPath }));
    const provider = fakeProvider("new content");

    const [job] = await runBatch(
      baseOptions({ filePaths: [pdfPath], overwrite: true, resumeMode: false }),
      { createProvider: () => provider, providerName: "mock", model: "m", onProgress: () => {} },
    );

    expect(job.status).toBe("success");
    expect(provider.generateMarkdown).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(path.join(tempDir, "done.md"), "utf-8")).toBe("new content");
  });
});
