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

import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import dotenv from "dotenv";
import { registerIpcHandlers } from "./ipc";
import { buildApplicationMenu } from "./menu";

// Loads from the project root in dev, and from the packaged app's directory
// when built. Never overrides variables already present in the environment.
dotenv.config({ path: path.join(app.getAppPath(), ".env") });
dotenv.config();

const isDev = process.env.NODE_ENV === "development";

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "PaperDistill",
    icon: path.join(app.getAppPath(), "build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The footer's credit links are external: hand them to the system browser
  // rather than letting Electron open a chromeless app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  Menu.setApplicationMenu(buildApplicationMenu(mainWindow));
  registerIpcHandlers(mainWindow);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
