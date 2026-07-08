import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { AppConfig } from "../shared/types";

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), "utf-8");
}
