"use client";

import { useState, useEffect, useCallback } from "react";

interface FoundryConfig {
  foundryUrl: string;
  configuredAt: string;
}

interface FoundryStatus {
  connected: boolean;
  lastHeartbeat: number | null;
  lastHeartbeatAgo: number | null;
}

export default function FoundrySetup() {
  const [config, setConfig] = useState<FoundryConfig | null>(null);
  const [status, setStatus] = useState<FoundryStatus>({ connected: false, lastHeartbeat: null, lastHeartbeatAgo: null });
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [foundryUrl, setFoundryUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Ping state
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/foundry-status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchStatus();
  }, [fetchStatus]);

  // Poll status every 5s
  useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/foundry-config");
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

  async function saveUrl() {
    if (!foundryUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/foundry-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundryUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    try {
      const res = await fetch("/api/foundry-config", { method: "DELETE" });
      if (res.ok) {
        setConfig(null);
        setCollapsed(false);
      }
    } catch {
      // ignore
    }
  }

  async function pingFoundry() {
    if (!config?.foundryUrl) return;
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch("/api/foundry-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundryUrl: config.foundryUrl }),
      });
      const data = await res.json();
      setPingResult(data);
    } catch {
      setPingResult({ ok: false, message: "Failed to reach the server" });
    } finally {
      setPinging(false);
    }
  }

  function startEdit() {
    setFoundryUrl(config?.foundryUrl ?? "");
    setEditing(true);
    setPingResult(null);
  }

  async function copyWebAppUrl() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) return null;

  const statusLabel = status.connected ? "Connected" : config ? "Disconnected" : null;
  const statusDot = status.connected
    ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
    : config
      ? "bg-amber-400"
      : "bg-gray-500";

  return (
    <div className="mb-8 rounded-xl border border-gray-700 bg-gray-800 shadow-lg">
      {/* Header */}
      <button
        onClick={() => {
          if (!editing) setCollapsed(!collapsed);
        }}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          {/* Foundry/D20 icon */}
          <svg className="h-6 w-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.18l6.5 3.64v2.36L12 6.5 5.5 10.18V7.82L12 4.18zM5.5 12.18L12 15.82l6.5-3.64v2.36L12 18.18l-6.5-3.64v-2.36z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-100">Foundry VTT</h2>
          {statusLabel && (
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              <span className={`text-xs font-medium ${status.connected ? "text-green-400" : "text-amber-400"}`}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
        {!editing && (
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
          {config && !editing && (
            <div>
              {/* Connection info */}
              <div className="mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Foundry URL:</span>
                  <span className="text-gray-200">{config.foundryUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Heartbeat:</span>
                  {status.connected ? (
                    <span className="text-green-400">Active (last {Math.round((status.lastHeartbeatAgo ?? 0) / 1000)}s ago)</span>
                  ) : status.lastHeartbeatAgo !== null ? (
                    <span className="text-amber-400">Stale (last seen {Math.round(status.lastHeartbeatAgo / 1000)}s ago)</span>
                  ) : (
                    <span className="text-gray-400">No heartbeat received yet</span>
                  )}
                </div>
              </div>

              {/* Setup instructions */}
              <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                <p className="mb-2 text-xs font-medium text-gray-400">
                  In Foundry VTT, configure the GLUniverse Reactive Image module with:
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Web App URL:</span>
                  <code className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-indigo-300">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyWebAppUrl(); }}
                    className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 transition hover:bg-gray-600"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  The API Secret in Foundry must match your server&apos;s API_SECRET env variable.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={pingFoundry}
                  disabled={pinging}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pinging ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Pinging...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </button>
                <button
                  onClick={startEdit}
                  className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition hover:bg-indigo-600/30"
                >
                  Reconfigure
                </button>
                <button
                  onClick={disconnect}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  Remove
                </button>
              </div>

              {/* Ping result */}
              {pingResult && (
                <div className={`mt-3 rounded-lg p-2.5 text-xs ${pingResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {pingResult.message}
                </div>
              )}
            </div>
          )}

          {/* Not configured / editing */}
          {(!config || editing) && (
            <div>
              {!config && (
                <p className="mb-3 text-sm text-gray-400">
                  Enter your Foundry VTT URL to set up the connection.
                  The Foundry module will push data to this web app automatically.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={foundryUrl}
                  onChange={(e) => setFoundryUrl(e.target.value)}
                  placeholder="http://localhost:30000"
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={saveUrl}
                  disabled={!foundryUrl.trim() || saving}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {editing && (
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-gray-500 hover:text-gray-400"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Setup instructions when not configured */}
              {!config && (
                <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-400">
                    In Foundry VTT, configure the GLUniverse Reactive Image module with:
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Web App URL:</span>
                    <code className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-indigo-300">
                      {typeof window !== "undefined" ? window.location.origin : ""}
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyWebAppUrl(); }}
                      className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 transition hover:bg-gray-600"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    The API Secret in Foundry must match your server&apos;s API_SECRET env variable.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
