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

export type JobStatus =
  | "pending"
  | "processing"
  | "success"
  | "skipped"
  | "warning"
  | "failed";

export type ProcessingMode = "single_call" | "chunked";

export type LLMProviderName = "anthropic" | "openai" | "ollama";

export type InputFileKind = "pdf" | "docx" | "xlsx" | "txt" | "md";

/** Checkbox order in the Input Folder row. */
export const INPUT_FILE_KINDS: InputFileKind[] = ["pdf", "docx", "xlsx", "txt", "md"];

export const INPUT_FILE_KIND_LABELS: Record<InputFileKind, string> = {
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  txt: "TXT",
  md: "MD",
};

/** Lower-case file extension, without the dot, matched for each kind. */
export const INPUT_FILE_KIND_EXTENSIONS: Record<InputFileKind, string> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  txt: "txt",
  md: "md",
};

export const DEFAULT_INPUT_FILE_KINDS: InputFileKind[] = ["pdf"];

export interface PdfJob {
  fileName: string;
  filePath: string;
  pageCount: number | null;
  characterCount: number | null;
  status: JobStatus;
  processingMode: ProcessingMode | null;
  outputPath: string | null;
  errorMessage: string | null;
}

export interface ScanInputFolderOptions {
  folderPath: string;
  recursive: boolean;
  fileTypes: InputFileKind[];
}

export interface ProviderConfig {
  providerName: LLMProviderName;
  model: string;
  /** Session-only override; falls back to the corresponding env var when absent. */
  apiKey?: string;
  /** Ollama only. */
  ollamaUrl?: string;
}

export interface StartBatchOptions {
  filePaths: string[];
  promptFilePath: string;
  outputFolder: string;
  providerConfig: ProviderConfig;
  overwrite: boolean;
  resumeMode: boolean;
  writeFailureFiles: boolean;
  addYamlHeader: boolean;
  maxInputChars: number;
  chunkSizeChars: number;
  chunkOverlapChars: number;
}

export interface AppConfig {
  providerName?: LLMProviderName;
  anthropicModel?: string;
  openaiModel?: string;
  ollamaModel?: string;
  ollamaUrl?: string;
  recursive?: boolean;
  fileTypes?: InputFileKind[];
  overwrite?: boolean;
  resumeMode?: boolean;
  writeFailureFiles?: boolean;
  addYamlHeader?: boolean;
  maxInputChars?: number;
  chunkSizeChars?: number;
  chunkOverlapChars?: number;
}

export interface EnvKeyStatus {
  anthropicKeyPresent: boolean;
  openaiKeyPresent: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface OllamaConnectionTestResult extends ConnectionTestResult {
  models?: string[];
}

export type BundledPromptId = "papers" | "proposals";

export interface PaperDistillAPI {
  selectInputFolder(): Promise<string | null>;
  selectPromptFile(): Promise<string | null>;
  selectOutputFolder(): Promise<string | null>;
  getBundledPromptPath(id: BundledPromptId): Promise<string>;
  scanInputFolder(options: ScanInputFolderOptions): Promise<PdfJob[]>;
  onScanStarted(callback: (jobs: PdfJob[]) => void): () => void;
  onScanProgress(callback: (job: PdfJob) => void): () => void;
  startBatch(options: StartBatchOptions): Promise<PdfJob[]>;
  onBatchProgress(callback: (job: PdfJob) => void): () => void;
  getEnvKeyStatus(): Promise<EnvKeyStatus>;
  testOllamaConnection(baseUrl: string): Promise<OllamaConnectionTestResult>;
  testAnthropicConnection(apiKey: string, model: string): Promise<ConnectionTestResult>;
  testOpenAIConnection(apiKey: string, model: string): Promise<ConnectionTestResult>;
  pauseBatch(): Promise<void>;
  resumeBatch(): Promise<void>;
  cancelBatch(): Promise<void>;
  openOutputFolder(outputFolder: string): Promise<void>;
  loadConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<void>;
}

declare global {
  interface Window {
    api: PaperDistillAPI;
  }
}
