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
import { extractPdfText } from "./pdfExtract";
import type { PdfExtractionResult } from "./pdfExtract";
import { buildPrompt } from "./promptBuilder";
import { splitIntoChunks } from "./chunker";
import { DEFAULT_SYSTEM_PROMPT } from "./providers/base";
import type { LLMProvider } from "./providers/base";
import type { PdfJob, ProcessingMode, StartBatchOptions } from "../shared/types";

const RUN_LOG_FILENAME = "paperdistill_run_log.jsonl";

const CHUNK_NOTES_INSTRUCTION =
  "This is only one chunk of a longer paper. Extract factual information only from this chunk. Do not produce the final Markdown yet. Preserve uncertainty and page references where available.";

const SYNTHESIS_INSTRUCTION =
  'Use only the extracted chunk notes below. Do not invent missing information. If information required by the prompt is absent, write "Not found in PDF". Produce the final Markdown according to the original prompt.';

export interface RunBatchDeps {
  createProvider: () => LLMProvider;
  providerName: string;
  model: string;
  onProgress: (job: PdfJob) => void;
}

export class BatchControl {
  private paused = false;
  private cancelled = false;
  private resumeWaiters: Array<() => void> = [];

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.resumeWaiters.forEach((resolve) => resolve());
    this.resumeWaiters = [];
  }

  cancel(): void {
    this.cancelled = true;
    this.resume();
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  async waitIfPaused(): Promise<void> {
    if (!this.paused) return;
    await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
  }
}

interface RunLogEntry {
  timestamp: string;
  pdf_path: string;
  output_md: string | null;
  provider: string;
  model: string;
  status: PdfJob["status"];
  error: string | null;
  page_count: number | null;
  extracted_character_count: number | null;
  processing_mode: PdfJob["processingMode"];
}

async function appendRunLog(outputFolder: string, entry: RunLogEntry): Promise<void> {
  const logPath = path.join(outputFolder, RUN_LOG_FILENAME);
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf-8");
}

async function writeSidecarJson(
  outputFolder: string,
  filePath: string,
  job: PdfJob,
  providerName: string,
  model: string,
): Promise<void> {
  const stem = path.basename(filePath, path.extname(filePath));
  const sidecarPath = path.join(outputFolder, `${stem}.paperdistill.json`);
  const content = {
    pdf_path: filePath,
    output_md: job.outputPath,
    provider: providerName,
    model,
    page_count: job.pageCount,
    status: job.status,
    error: job.errorMessage,
  };
  await fs.writeFile(sidecarPath, JSON.stringify(content, null, 2), "utf-8");
}

async function writeFailureFile(outputFolder: string, filePath: string, message: string): Promise<void> {
  const stem = path.basename(filePath, path.extname(filePath));
  const failurePath = path.join(outputFolder, `${stem}.failed.txt`);
  await fs.writeFile(failurePath, message, "utf-8");
}

async function recordJobResult(
  options: StartBatchOptions,
  filePath: string,
  job: PdfJob,
  providerName: string,
  model: string,
): Promise<void> {
  await appendRunLog(options.outputFolder, {
    timestamp: new Date().toISOString(),
    pdf_path: filePath,
    output_md: job.outputPath,
    provider: providerName,
    model,
    status: job.status,
    error: job.errorMessage,
    page_count: job.pageCount,
    extracted_character_count: job.characterCount,
    processing_mode: job.processingMode,
  });
  await writeSidecarJson(options.outputFolder, filePath, job, providerName, model);
  if (job.status === "failed" && options.writeFailureFiles && job.errorMessage) {
    await writeFailureFile(options.outputFolder, filePath, job.errorMessage);
  }
}

async function writeMarkdownAtomic(outputPath: string, content: string): Promise<void> {
  const tempPath = `${outputPath}.tmp`;
  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, outputPath);
}

function yamlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildYamlHeader(params: {
  sourcePdf: string;
  provider: string;
  model: string;
  pageCount: number | null;
  processingMode: ProcessingMode;
}): string {
  return [
    "---",
    `source_pdf: "${yamlEscape(params.sourcePdf)}"`,
    `provider: "${yamlEscape(params.provider)}"`,
    `model: "${yamlEscape(params.model)}"`,
    `page_count: ${params.pageCount ?? "null"}`,
    `generated_at: "${new Date().toISOString()}"`,
    `processing_mode: "${params.processingMode}"`,
    "---",
    "",
    "",
  ].join("\n");
}

export function outputPathFor(outputFolder: string, filePath: string): string {
  const stem = path.basename(filePath, path.extname(filePath));
  return path.join(outputFolder, `${stem}.md`);
}

async function fileExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

interface GeneratedMarkdown {
  text: string;
  processingMode: ProcessingMode;
}

async function generateMarkdownForPdf(
  extraction: PdfExtractionResult,
  promptTemplate: string,
  options: StartBatchOptions,
  deps: RunBatchDeps,
  onChunkProgress: (message: string) => void,
): Promise<GeneratedMarkdown> {
  const singleCallPrompt = buildPrompt({
    promptTemplate,
    pdfText: extraction.text,
    pdfFileName: extraction.fileName,
    pdfPath: extraction.filePath,
    pageCount: extraction.pageCount,
  });

  if (singleCallPrompt.length < options.maxInputChars) {
    const provider = deps.createProvider();
    const result = await provider.generateMarkdown({
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPrompt: singleCallPrompt,
      model: deps.model,
    });
    return { text: result.text, processingMode: "single_call" };
  }

  const chunks = splitIntoChunks(extraction.text, {
    chunkSizeChars: options.chunkSizeChars,
    chunkOverlapChars: options.chunkOverlapChars,
  });

  const chunkNotes: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onChunkProgress(`Extracting chunk ${i + 1}/${chunks.length}...`);

    const chunkPrompt = `${CHUNK_NOTES_INSTRUCTION}\n\n${buildPrompt({
      promptTemplate,
      pdfText: chunks[i],
      pdfFileName: extraction.fileName,
      pdfPath: extraction.filePath,
      pageCount: extraction.pageCount,
    })}`;

    const provider = deps.createProvider();
    const chunkResult = await provider.generateMarkdown({
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPrompt: chunkPrompt,
      model: deps.model,
    });
    chunkNotes.push(chunkResult.text);
  }

  onChunkProgress(`Synthesizing final Markdown from ${chunks.length} chunk(s)...`);

  const combinedNotes = chunkNotes
    .map((note, i) => `--- Chunk ${i + 1} notes ---\n${note}`)
    .join("\n\n");

  const synthesisPrompt = `${SYNTHESIS_INSTRUCTION}\n\n${buildPrompt({
    promptTemplate,
    pdfText: combinedNotes,
    pdfFileName: extraction.fileName,
    pdfPath: extraction.filePath,
    pageCount: extraction.pageCount,
  })}`;

  const provider = deps.createProvider();
  const synthesisResult = await provider.generateMarkdown({
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: synthesisPrompt,
    model: deps.model,
  });

  return { text: synthesisResult.text, processingMode: "chunked" };
}

function makeInitialJob(filePath: string): PdfJob {
  return {
    fileName: path.basename(filePath),
    filePath,
    pageCount: null,
    characterCount: null,
    status: "processing",
    processingMode: null,
    outputPath: null,
    errorMessage: null,
    likelyScanned: false,
  };
}

export async function runBatch(
  options: StartBatchOptions,
  deps: RunBatchDeps,
  control: BatchControl = new BatchControl(),
): Promise<PdfJob[]> {
  const promptTemplate = await fs.readFile(options.promptFilePath, "utf-8");
  const jobs: PdfJob[] = [];

  for (const filePath of options.filePaths) {
    if (control.isCancelled) break;
    await control.waitIfPaused();
    if (control.isCancelled) break;

    let job = makeInitialJob(filePath);
    deps.onProgress(job);

    const outputPath = outputPathFor(options.outputFolder, filePath);
    const alreadyExists = await fileExists(outputPath);
    const shouldSkip = alreadyExists && (options.resumeMode || !options.overwrite);

    if (shouldSkip) {
      job = {
        ...job,
        status: "skipped",
        errorMessage: options.resumeMode
          ? "Output already exists; skipped (resume mode)."
          : "Output already exists. Enable overwrite to reprocess.",
      };
      deps.onProgress(job);
      await recordJobResult(options, filePath, job, deps.providerName, deps.model);
      jobs.push(job);
      continue;
    }

    try {
      const extraction = await extractPdfText(filePath);
      job = {
        ...job,
        pageCount: extraction.pageCount,
        characterCount: extraction.characterCount,
        likelyScanned: extraction.likelyScanned,
      };

      if (extraction.likelyScanned) {
        job = {
          ...job,
          status: "warning",
          errorMessage: "Likely a scanned PDF: little or no extractable text found. Skipped.",
        };
      } else {
        const generated = await generateMarkdownForPdf(
          extraction,
          promptTemplate,
          options,
          deps,
          (message) => deps.onProgress({ ...job, errorMessage: message }),
        );

        const markdownContent = options.addYamlHeader
          ? buildYamlHeader({
              sourcePdf: filePath,
              provider: deps.providerName,
              model: deps.model,
              pageCount: extraction.pageCount,
              processingMode: generated.processingMode,
            }) + generated.text
          : generated.text;

        await writeMarkdownAtomic(outputPath, markdownContent);

        job = {
          ...job,
          status: "success",
          outputPath,
          processingMode: generated.processingMode,
        };
      }
    } catch (error) {
      job = {
        ...job,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    deps.onProgress(job);
    await recordJobResult(options, filePath, job, deps.providerName, deps.model);
    jobs.push(job);
  }

  if (control.isCancelled) {
    const processedPaths = new Set(jobs.map((job) => job.filePath));
    for (const filePath of options.filePaths) {
      if (processedPaths.has(filePath)) continue;
      const skippedJob: PdfJob = {
        ...makeInitialJob(filePath),
        status: "skipped",
        errorMessage: "Batch cancelled before this PDF was processed.",
      };
      deps.onProgress(skippedJob);
      jobs.push(skippedJob);
    }
  }

  return jobs;
}
