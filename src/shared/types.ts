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

export interface PdfJob {
  fileName: string;
  filePath: string;
  pageCount: number | null;
  characterCount: number | null;
  status: JobStatus;
  processingMode: ProcessingMode | null;
  outputPath: string | null;
  errorMessage: string | null;
  likelyScanned: boolean;
}

export interface ScanPdfFolderOptions {
  folderPath: string;
  recursive: boolean;
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

export interface PaperDistillAPI {
  selectPdfFolder(): Promise<string | null>;
  selectPromptFile(): Promise<string | null>;
  selectOutputFolder(): Promise<string | null>;
  getDefaultPromptPath(): Promise<string>;
  scanPdfFolder(options: ScanPdfFolderOptions): Promise<PdfJob[]>;
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
