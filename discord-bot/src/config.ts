import { readFileSync } from "fs";
import { join } from "path";

export interface DiscordBotConfig {
  botToken: string;
  guildId: string;
  guildName: string;
  voiceChannelId: string;
  voiceChannelName: string;
  botUsername: string;
  configuredAt: string;
}

/**
 * Reads Discord bot config from config.json at the project root.
 * Tries process.cwd()/config.json first, then ../config.json (when run from discord-bot/).
 */
export function readConfigFromFile(): DiscordBotConfig | null {
  const paths = [
    join(process.cwd(), "config.json"),
    join(process.cwd(), "..", "config.json"),
  ];

  for (const configPath of paths) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.discord && parsed.discord.botToken) {
        return parsed.discord as DiscordBotConfig;
      }
    } catch {
      // file not found or invalid JSON — try next path
    }
  }

  return null;
}
