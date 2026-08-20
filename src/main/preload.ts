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

import { contextBridge, ipcRenderer } from "electron";
import type { PaperDistillAPI, PdfJob } from "../shared/types";

const api: PaperDistillAPI = {
  selectInputFolder: () => ipcRenderer.invoke("fs:selectInputFolder"),
  selectPromptFile: () => ipcRenderer.invoke("fs:selectPromptFile"),
  selectOutputFolder: () => ipcRenderer.invoke("fs:selectOutputFolder"),
  getBundledPromptPath: (id) => ipcRenderer.invoke("fs:getBundledPromptPath", id),
  scanInputFolder: (options) => ipcRenderer.invoke("files:scan", options),
  onScanStarted: (callback: (jobs: PdfJob[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, jobs: PdfJob[]) => callback(jobs);
    ipcRenderer.on("files:scanStarted", listener);
    return () => ipcRenderer.removeListener("files:scanStarted", listener);
  },
  onScanProgress: (callback: (job: PdfJob) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, job: PdfJob) => callback(job);
    ipcRenderer.on("files:scanProgress", listener);
    return () => ipcRenderer.removeListener("files:scanProgress", listener);
  },
  startBatch: (options) => ipcRenderer.invoke("batch:start", options),
  onBatchProgress: (callback: (job: PdfJob) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, job: PdfJob) => callback(job);
    ipcRenderer.on("batch:progress", listener);
    return () => ipcRenderer.removeListener("batch:progress", listener);
  },
  getEnvKeyStatus: () => ipcRenderer.invoke("env:getKeyStatus"),
  testOllamaConnection: (baseUrl) => ipcRenderer.invoke("ollama:testConnection", baseUrl),
  testAnthropicConnection: (apiKey, model) =>
    ipcRenderer.invoke("anthropic:testConnection", apiKey, model),
  testOpenAIConnection: (apiKey, model) => ipcRenderer.invoke("openai:testConnection", apiKey, model),
  pauseBatch: () => ipcRenderer.invoke("batch:pause"),
  resumeBatch: () => ipcRenderer.invoke("batch:resume"),
  cancelBatch: () => ipcRenderer.invoke("batch:cancel"),
  openOutputFolder: (outputFolder) => ipcRenderer.invoke("fs:openOutputFolder", outputFolder),
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
};

contextBridge.exposeInMainWorld("api", api);
