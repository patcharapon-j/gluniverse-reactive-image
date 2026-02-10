import { spawn, execSync, type ChildProcess } from "child_process";
import { readFileSync } from "fs";
import path from "path";

let botProcess: ChildProcess | null = null;
let botLogs: string[] = [];
let intentionallyStopped = false;
let restartAttempts = 0;
const MAX_LOG_LINES = 100;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY_MS = 3000;

function addLog(line: string) {
  botLogs.push(line);
  if (botLogs.length > MAX_LOG_LINES) {
    botLogs = botLogs.slice(-MAX_LOG_LINES);
  }
}

export function isBotRunning(): boolean {
  return botProcess !== null && botProcess.exitCode === null;
}

export function getBotStatus(): { running: boolean; logs: string[] } {
  return { running: isBotRunning(), logs: [...botLogs] };
}

export function startBot(): { success: boolean; error?: string } {
  if (isBotRunning()) {
    return { success: false, error: "Bot is already running" };
  }

  const botDir = path.join(process.cwd(), "discord-bot");
  botLogs = [];
  intentionallyStopped = false;
  restartAttempts = 0;
  addLog("[system] Starting bot...");

  try {
    // Read discord config from config.json and pass as env vars
    const botEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      WEBAPP_URL:
        process.env.WEBAPP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000",
    };

    if (process.env.API_SECRET) {
      botEnv.API_SECRET = process.env.API_SECRET;
    }

    try {
      const configPath = path.join(process.cwd(), "config.json");
      const raw = readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      if (config.discord) {
        if (config.discord.botToken) botEnv.DISCORD_BOT_TOKEN = config.discord.botToken;
        if (config.discord.guildId) botEnv.GUILD_ID = config.discord.guildId;
        if (config.discord.voiceChannelId) botEnv.VOICE_CHANNEL_ID = config.discord.voiceChannelId;
      }
    } catch {
      // config.json not found or invalid — bot will fall back to its own env
    }

    botProcess = spawn("npm", ["run", "start"], {
      cwd: botDir,
      shell: true,
      env: botEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addLog(`[system] Failed to spawn bot: ${msg}`);
    return { success: false, error: msg };
  }

  botProcess.stdout?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach(addLog);
  });

  botProcess.stderr?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter(Boolean).forEach((l) => addLog(`[stderr] ${l}`));
  });

  botProcess.on("exit", (code) => {
    addLog(`[system] Bot exited with code ${code}`);
    botProcess = null;

    if (!intentionallyStopped && code !== 0) {
      restartAttempts++;
      if (restartAttempts <= MAX_RESTART_ATTEMPTS) {
        addLog(`[system] Unexpected exit — restarting in ${RESTART_DELAY_MS / 1000}s (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
        setTimeout(() => {
          if (!intentionallyStopped && !isBotRunning()) {
            startBot();
          }
        }, RESTART_DELAY_MS);
      } else {
        addLog(`[system] Too many restart attempts (${MAX_RESTART_ATTEMPTS}). Giving up. Use the dashboard to restart manually.`);
      }
    }
  });

  botProcess.on("error", (err) => {
    addLog(`[system] Bot error: ${err.message}`);
    botProcess = null;
  });

  return { success: true };
}

export function stopBot(): { success: boolean; error?: string } {
  if (!isBotRunning() || !botProcess) {
    return { success: false, error: "Bot is not running" };
  }

  intentionallyStopped = true;
  addLog("[system] Stopping bot...");
  killBotProcess();

  return { success: true };
}

function killBotProcess() {
  if (!botProcess) return;
  const pid = botProcess.pid;

  if (process.platform === "win32" && pid) {
    // On Windows with shell: true, we need to kill the whole process tree
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      // process may already be dead
    }
  } else {
    botProcess.kill("SIGTERM");
    // Force kill after 5s if still alive
    const proc = botProcess;
    setTimeout(() => {
      if (proc && proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }, 5000);
  }
}

// Kill the bot when the Next.js server shuts down
function cleanupOnExit() {
  if (botProcess && botProcess.exitCode === null) {
    intentionallyStopped = true;
    killBotProcess();
  }
}

process.on("exit", cleanupOnExit);
process.on("SIGINT", () => { cleanupOnExit(); process.exit(0); });
process.on("SIGTERM", () => { cleanupOnExit(); process.exit(0); });
