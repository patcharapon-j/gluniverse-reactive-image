"use client";

import { useState, useEffect, useCallback } from "react";
import type { DiscordGuild, DiscordChannel } from "@/lib/types";

type Step = "idle" | "token" | "guild" | "channel";

interface MaskedConfig {
  botTokenMasked: string;
  guildId: string;
  guildName: string;
  voiceChannelId: string;
  voiceChannelName: string;
  botUsername: string;
  configuredAt: string;
}

export default function DiscordBotSetup() {
  const [step, setStep] = useState<Step>("idle");
  const [collapsed, setCollapsed] = useState(true);
  const [config, setConfig] = useState<MaskedConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Bot process state
  const [botRunning, setBotRunning] = useState(false);
  const [botStarting, setBotStarting] = useState(false);
  const [botStopping, setBotStopping] = useState(false);
  const [botLogs, setBotLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Token step
  const [token, setToken] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [validating, setValidating] = useState(false);
  const [tokenError, setTokenError] = useState("");

  // Guild step
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);
  const [loadingGuilds, setLoadingGuilds] = useState(false);

  // Channel step
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<DiscordChannel | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/discord-bot/status");
      if (res.ok) {
        const data = await res.json();
        setBotRunning(data.running);
        setBotLogs(data.logs);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchBotStatus();
  }, [fetchBotStatus]);

  // Poll bot status every 3s
  useEffect(() => {
    const interval = setInterval(fetchBotStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/discord-bot/config");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig(data);
          setCollapsed(true);
        } else {
          setCollapsed(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function validateToken() {
    setValidating(true);
    setTokenError("");
    try {
      const res = await fetch("/api/discord-bot/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.valid) {
        setBotUsername(data.bot.username);
        setStep("guild");
        fetchGuilds();
      } else {
        setTokenError("Invalid bot token. Make sure you copied the full token.");
      }
    } catch {
      setTokenError("Failed to validate token. Check your connection.");
    } finally {
      setValidating(false);
    }
  }

  async function fetchGuilds() {
    setLoadingGuilds(true);
    try {
      const res = await fetch("/api/discord-bot/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setGuilds(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoadingGuilds(false);
    }
  }

  async function selectGuild(guild: DiscordGuild) {
    setSelectedGuild(guild);
    setStep("channel");
    setLoadingChannels(true);
    try {
      const res = await fetch("/api/discord-bot/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, guildId: guild.id }),
      });
      if (res.ok) {
        setChannels(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoadingChannels(false);
    }
  }

  async function saveConfiguration() {
    if (!selectedGuild || !selectedChannel) return;
    setSaving(true);
    try {
      const res = await fetch("/api/discord-bot/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: token,
          guildId: selectedGuild.id,
          guildName: selectedGuild.name,
          voiceChannelId: selectedChannel.id,
          voiceChannelName: selectedChannel.name,
          botUsername,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        resetWizard();
        setCollapsed(false);
        // Auto-start the bot after saving config
        await startBotProcess();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function startBotProcess() {
    setBotStarting(true);
    try {
      const res = await fetch("/api/discord-bot/start", { method: "POST" });
      if (res.ok) {
        setBotRunning(true);
      }
    } catch {
      // ignore
    } finally {
      setBotStarting(false);
    }
  }

  async function stopBotProcess() {
    setBotStopping(true);
    try {
      const res = await fetch("/api/discord-bot/stop", { method: "POST" });
      if (res.ok) {
        setBotRunning(false);
      }
    } catch {
      // ignore
    } finally {
      setBotStopping(false);
    }
  }

  async function disconnect() {
    // Stop bot first if running
    if (botRunning) {
      await stopBotProcess();
    }
    try {
      const res = await fetch("/api/discord-bot/config", { method: "DELETE" });
      if (res.ok) {
        setConfig(null);
        setCollapsed(false);
        setBotLogs([]);
      }
    } catch {
      // ignore
    }
  }

  function resetWizard() {
    setStep("idle");
    setToken("");
    setBotUsername("");
    setTokenError("");
    setGuilds([]);
    setSelectedGuild(null);
    setChannels([]);
    setSelectedChannel(null);
  }

  async function startConfigure() {
    // Stop bot if running before reconfiguring
    if (botRunning) {
      await stopBotProcess();
    }
    resetWizard();
    setStep("token");
    setCollapsed(false);
  }

  if (loading) return null;

  const statusDot = botRunning
    ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
    : config
      ? "bg-amber-400"
      : "bg-gray-500";

  const statusLabel = botRunning ? "Running" : config ? "Stopped" : null;

  return (
    <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800 shadow-lg">
      {/* Header — always visible */}
      <button
        onClick={() => {
          if (config && step === "idle") setCollapsed(!collapsed);
        }}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          {/* Discord icon */}
          <svg className="h-6 w-6 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-100">Discord Bot</h2>
          {statusLabel && (
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              <span className={`text-xs font-medium ${botRunning ? "text-green-400" : "text-amber-400"}`}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
        {config && step === "idle" && (
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-gray-700 p-4">
          {/* Configured state */}
          {config && step === "idle" && (
            <div>
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Bot:</span>
                  <span className="text-gray-200">{config.botUsername}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Server:</span>
                  <span className="text-gray-200">{config.guildName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Channel:</span>
                  <span className="text-gray-200">{config.voiceChannelName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Token:</span>
                  <span className="font-mono text-gray-400">{config.botTokenMasked}</span>
                </div>
              </div>

              {/* Bot controls */}
              <div className="mb-3 flex flex-wrap gap-2">
                {botRunning ? (
                  <button
                    onClick={stopBotProcess}
                    disabled={botStopping}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {botStopping ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
                        </svg>
                        Stop Bot
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={startBotProcess}
                    disabled={botStarting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {botStarting ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Start Bot
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={startConfigure}
                  className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition hover:bg-indigo-600/30"
                >
                  Reconfigure
                </button>
                <button
                  onClick={disconnect}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="rounded-lg bg-gray-700/50 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-700"
                >
                  {showLogs ? "Hide Logs" : "Show Logs"}
                </button>
              </div>

              {/* Log viewer */}
              {showLogs && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-3 font-mono text-xs text-gray-400">
                  {botLogs.length === 0 ? (
                    <span className="text-gray-600">No logs yet</span>
                  ) : (
                    botLogs.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Not configured — show configure button */}
          {!config && step === "idle" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-gray-400">
                Connect your Discord bot to detect voice activity.
              </p>
              <button
                onClick={() => { resetWizard(); setStep("token"); }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4752C4]"
              >
                Configure Bot
              </button>
            </div>
          )}

          {/* Step 1: Token */}
          {step === "token" && (
            <div>
              <StepHeader number={1} title="Bot Token" subtitle="Paste your Discord bot token" />
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste bot token here..."
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={validateToken}
                  disabled={!token.trim() || validating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validating ? "Validating..." : "Validate"}
                </button>
              </div>
              {tokenError && (
                <p className="mt-2 text-sm text-red-400">{tokenError}</p>
              )}
              <button
                onClick={() => { resetWizard(); if (config) setCollapsed(true); }}
                className="mt-3 text-xs text-gray-500 hover:text-gray-400"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Step 2: Guild */}
          {step === "guild" && (
            <div>
              <StepHeader
                number={2}
                title="Select Server"
                subtitle={`Logged in as ${botUsername}`}
              />
              {loadingGuilds ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500" />
                  Loading servers...
                </div>
              ) : guilds.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">
                  No servers found. Make sure the bot has been invited to at least one server.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {guilds.map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => selectGuild(guild)}
                      className="flex items-center gap-3 rounded-lg border border-gray-600 bg-gray-900 p-3 text-left text-sm transition hover:border-indigo-500 hover:bg-gray-800"
                    >
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=40`}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-300">
                          {guild.name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate text-gray-200">{guild.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setStep("token")}
                className="mt-3 text-xs text-gray-500 hover:text-gray-400"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 3: Channel */}
          {step === "channel" && selectedGuild && (
            <div>
              <StepHeader
                number={3}
                title="Select Voice Channel"
                subtitle={`Server: ${selectedGuild.name}`}
              />
              {loadingChannels ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500" />
                  Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">
                  No voice channels found. Make sure the bot has permission to view channels.
                </p>
              ) : (
                <div className="mt-3 space-y-1">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel)}
                      className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition ${
                        selectedChannel?.id === channel.id
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-gray-600 bg-gray-900 text-gray-200 hover:border-gray-500 hover:bg-gray-800"
                      }`}
                    >
                      {/* Speaker icon */}
                      <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H4v4h4l4 4V6z" />
                      </svg>
                      {channel.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setStep("guild")}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  Back
                </button>
                <button
                  onClick={saveConfiguration}
                  disabled={!selectedChannel || saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving & Starting..." : "Save & Connect"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-medium text-gray-200">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
