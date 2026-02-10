import { spawn, execSync, type ChildProcess } from "child_process";
import path from "path";

let botProcess: ChildProcess | null = null;
let botLogs: string[] = [];
const MAX_LOG_LINES = 100;

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
  addLog("[system] Starting bot...");

  try {
    botProcess = spawn("npm", ["run", "start"], {
      cwd: botDir,
      shell: true,
      env: { ...process.env },
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

  addLog("[system] Stopping bot...");
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

  return { success: true };
}
