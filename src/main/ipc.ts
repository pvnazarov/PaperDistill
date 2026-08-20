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

import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { discoverInputFiles, selectInputFolder, selectOutputFolder, selectPromptFile } from "./fileSystem";
import { extractDocumentText } from "./documentExtract";
import { BatchControl, runBatch } from "./batchRunner";
import {
  createProvider,
  testAnthropicConnection,
  testOllamaConnection,
  testOpenAIConnection,
} from "./providers";
import { loadConfig, saveConfig } from "./configStore";
import type {
  AppConfig,
  BundledPromptId,
  ConnectionTestResult,
  EnvKeyStatus,
  OllamaConnectionTestResult,
  PdfJob,
  ScanInputFolderOptions,
  StartBatchOptions,
} from "../shared/types";

const BUNDLED_PROMPT_FILES: Record<BundledPromptId, string> = {
  papers: "default_prompt.txt",
  proposals: "prompt_proposals.txt",
};

let activeBatchControl: BatchControl | null = null;

function makePendingJob(filePath: string): PdfJob {
  return {
    fileName: path.basename(filePath),
    filePath,
    pageCount: null,
    characterCount: null,
    status: "pending",
    processingMode: null,
    outputPath: null,
    errorMessage: null,
  };
}

async function scanInputFolder(
  mainWindow: BrowserWindow,
  options: ScanInputFolderOptions,
): Promise<PdfJob[]> {
  const filePaths = await discoverInputFiles(
    options.folderPath,
    options.recursive,
    options.fileTypes,
  );
  const jobs: PdfJob[] = filePaths.map(makePendingJob);

  mainWindow.webContents.send("files:scanStarted", jobs);

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    mainWindow.webContents.send("files:scanProgress", {
      ...jobs[i],
      status: "processing",
    } satisfies PdfJob);

    try {
      const extraction = await extractDocumentText(filePath);
      jobs[i] = {
        fileName: extraction.fileName,
        filePath: extraction.filePath,
        pageCount: extraction.pageCount,
        characterCount: extraction.characterCount,
        status: extraction.noTextWarning ? "warning" : "pending",
        processingMode: null,
        outputPath: null,
        errorMessage: extraction.noTextWarning,
      };
    } catch (error) {
      jobs[i] = {
        ...jobs[i],
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    mainWindow.webContents.send("files:scanProgress", jobs[i]);
  }

  return jobs;
}

async function startBatch(mainWindow: BrowserWindow, options: StartBatchOptions): Promise<PdfJob[]> {
  const control = new BatchControl();
  activeBatchControl = control;
  try {
    return await runBatch(
      options,
      {
        createProvider: () => createProvider(options.providerConfig),
        providerName: options.providerConfig.providerName,
        model: options.providerConfig.model,
        onProgress: (job) => mainWindow.webContents.send("batch:progress", job),
      },
      control,
    );
  } finally {
    activeBatchControl = null;
  }
}

function getEnvKeyStatus(): EnvKeyStatus {
  return {
    anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  };
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle("fs:selectInputFolder", () => selectInputFolder(mainWindow));
  ipcMain.handle("fs:selectPromptFile", () => selectPromptFile(mainWindow));
  ipcMain.handle("fs:selectOutputFolder", () => selectOutputFolder(mainWindow));
  ipcMain.handle("fs:getBundledPromptPath", (_event, id: BundledPromptId): string =>
    path.join(app.getAppPath(), BUNDLED_PROMPT_FILES[id] ?? BUNDLED_PROMPT_FILES.papers),
  );
  ipcMain.handle("files:scan", (_event, options: ScanInputFolderOptions) =>
    scanInputFolder(mainWindow, options),
  );
  ipcMain.handle("batch:start", (_event, options: StartBatchOptions) =>
    startBatch(mainWindow, options),
  );
  ipcMain.handle("env:getKeyStatus", (): EnvKeyStatus => getEnvKeyStatus());
  ipcMain.handle(
    "ollama:testConnection",
    (_event, baseUrl: string): Promise<OllamaConnectionTestResult> => testOllamaConnection(baseUrl),
  );
  ipcMain.handle(
    "anthropic:testConnection",
    (_event, apiKey: string, model: string): Promise<ConnectionTestResult> =>
      testAnthropicConnection(apiKey || process.env.ANTHROPIC_API_KEY || "", model),
  );
  ipcMain.handle(
    "openai:testConnection",
    (_event, apiKey: string, model: string): Promise<ConnectionTestResult> =>
      testOpenAIConnection(apiKey || process.env.OPENAI_API_KEY || "", model),
  );
  ipcMain.handle("batch:pause", () => {
    activeBatchControl?.pause();
  });
  ipcMain.handle("batch:resume", () => {
    activeBatchControl?.resume();
  });
  ipcMain.handle("batch:cancel", () => {
    activeBatchControl?.cancel();
  });
  ipcMain.handle("fs:openOutputFolder", (_event, outputFolder: string) => shell.openPath(outputFolder));
  ipcMain.handle("config:load", (): Promise<AppConfig> => loadConfig());
  ipcMain.handle("config:save", (_event, config: AppConfig): Promise<void> => saveConfig(config));
}
