const MODULE_ID = "gluniverse-reactive-image";

// ---------------------------------------------------------------------------
// System-specific HP path presets
// ---------------------------------------------------------------------------

const SYSTEM_PRESETS = {
  dnd5e: { hpPath: "attributes.hp.value", maxHpPath: "attributes.hp.max" },
  pf2e:  { hpPath: "attributes.hp.value", maxHpPath: "attributes.hp.max" },
};

/**
 * Return the HP path defaults for the current game system.
 * Falls back to the dnd5e preset for unknown systems.
 */
function getSystemDefaults() {
  const systemId = game.system?.id;
  return SYSTEM_PRESETS[systemId] ?? SYSTEM_PRESETS.dnd5e;
}

// ---------------------------------------------------------------------------
// Reconnect Menu (Foundry FormApplication for settings button)
// ---------------------------------------------------------------------------

class ReconnectMenuApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-reconnect`,
      title: "GLUniverse – Reconnect",
      template: null,
      width: 300,
    });
  }

  /** Skip rendering a form — just run reconnect and close. */
  async render(force, options) {
    await reconnect();
    return this;
  }

  async _updateObject() {}
}

// ---------------------------------------------------------------------------
// Settings Registration
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
  const defaults = getSystemDefaults();

  game.settings.register(MODULE_ID, "webappUrl", {
    name: "Web App URL",
    hint: "The base URL of the GLUniverse Reactive Image web app (e.g. https://example.vercel.app).",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "apiSecret", {
    name: "API Secret",
    hint: "The shared secret used to authenticate with the web app (must match the server's API_SECRET env variable).",
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "hpPath", {
    name: "HP Attribute Path",
    hint: `Dot-notation path to HP value relative to actor.system. Auto-detected for DnD5e and PF2e. Current system: ${game.system?.id ?? "unknown"}.`,
    scope: "world",
    config: true,
    type: String,
    default: defaults.hpPath,
  });

  game.settings.register(MODULE_ID, "maxHpPath", {
    name: "Max HP Attribute Path",
    hint: `Dot-notation path to max HP relative to actor.system. Auto-detected for DnD5e and PF2e. Current system: ${game.system?.id ?? "unknown"}.`,
    scope: "world",
    config: true,
    type: String,
    default: defaults.maxHpPath,
  });

  game.settings.registerMenu(MODULE_ID, "reconnectMenu", {
    name: "Reconnect to Web App",
    label: "Reconnect",
    hint: "Re-push the actor roster and restart the heartbeat. Use this after changing settings or if the web app lost connection.",
    icon: "fas fa-sync",
    type: ReconnectMenuApp,
    restricted: true,
  });
});

// ---------------------------------------------------------------------------
// Reconnect
// ---------------------------------------------------------------------------

/**
 * Re-push the full actor roster and restart the heartbeat loop.
 * Called from the settings menu button and exposed on the module API.
 */
async function reconnect() {
  const conn = getConnectionSettings();
  if (!conn) {
    ui.notifications?.warn(`${MODULE_ID} | Set a Web App URL in module settings first.`);
    return;
  }

  // Reset notification flags so user gets fresh feedback
  _pushFailureNotified = false;
  _heartbeatConnectedNotified = false;

  const roster = buildRoster();
  console.log(`${MODULE_ID} | Reconnecting – pushing roster of ${roster.length} actors.`);
  await pushToWebApp({ type: "roster", data: roster });
  startHeartbeat();
  ui.notifications?.info(`${MODULE_ID} | Reconnection initiated.`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-notation path on an object. Returns undefined if any segment
 * is missing.
 */
function resolvePath(obj, path) {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

/**
 * Read the current settings for webapp URL and API secret.  Returns null when
 * the module is not configured yet so callers can bail out early.
 */
function getConnectionSettings() {
  const webappUrl = game.settings.get(MODULE_ID, "webappUrl");
  const apiSecret = game.settings.get(MODULE_ID, "apiSecret");
  if (!webappUrl) return null;
  return { webappUrl: webappUrl.replace(/\/+$/, ""), apiSecret };
}

// ---------------------------------------------------------------------------
// Connection state tracking
// ---------------------------------------------------------------------------

let _pushFailureNotified = false;
let _heartbeatConnectedNotified = false;
let _heartbeatInterval = null;
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * POST JSON to the web app's /api/state endpoint.  Shows a warning
 * notification on first failure and suppresses repeated failure messages.
 */
async function pushToWebApp(body) {
  const conn = getConnectionSettings();
  if (!conn) return;

  try {
    const res = await fetch(`${conn.webappUrl}/api/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": conn.apiSecret,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      // Reset failure flag on success so next failure gets a notification
      _pushFailureNotified = false;
    }
  } catch (err) {
    if (!_pushFailureNotified) {
      _pushFailureNotified = true;
      ui.notifications?.warn(`${MODULE_ID} | Cannot reach web app. Will keep retrying silently.`);
    }
    console.warn(`${MODULE_ID} | Failed to push state to web app:`, err);
  }
}

/**
 * Send a heartbeat to the web app so it knows Foundry is still connected.
 */
async function sendHeartbeat() {
  const conn = getConnectionSettings();
  if (!conn) return;

  try {
    const res = await fetch(`${conn.webappUrl}/api/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": conn.apiSecret,
      },
      body: JSON.stringify({ type: "foundry-heartbeat" }),
    });
    if (res.ok && !_heartbeatConnectedNotified) {
      _heartbeatConnectedNotified = true;
      ui.notifications?.info(`${MODULE_ID} | Connected to web app.`);
    }
    if (!res.ok) {
      _heartbeatConnectedNotified = false;
    }
  } catch {
    _heartbeatConnectedNotified = false;
  }
}

/**
 * Start the heartbeat loop. Sends immediately, then repeats every 30s.
 */
function startHeartbeat() {
  // Clear any existing interval (e.g. on re-init)
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
  sendHeartbeat();
  _heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

/**
 * Extract HP data for a single actor using the configured attribute paths.
 * Returns null if the actor has no valid HP data.
 */
function extractHpData(actor) {
  const hpPath = game.settings.get(MODULE_ID, "hpPath");
  const maxHpPath = game.settings.get(MODULE_ID, "maxHpPath");

  const hp = resolvePath(actor.system, hpPath);
  const maxHp = resolvePath(actor.system, maxHpPath);

  if (hp == null || maxHp == null) return null;

  return {
    actorId: actor.id,
    actorName: actor.name,
    hp: Number(hp),
    maxHp: Number(maxHp),
  };
}

/**
 * Build the full roster of character actors with HP data.
 */
function buildRoster() {
  const roster = [];
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    const data = extractHpData(actor);
    if (data) roster.push(data);
  }
  return roster;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * On world ready: push the full actor roster to the web app so it has an
 * initial snapshot of every character's HP.
 */
Hooks.on("ready", () => {
  const conn = getConnectionSettings();
  if (!conn) {
    console.log(`${MODULE_ID} | No web app URL configured – skipping initial roster push.`);
    return;
  }

  console.log(`${MODULE_ID} | Game system detected: ${game.system?.id ?? "unknown"}`);

  const roster = buildRoster();
  console.log(`${MODULE_ID} | Pushing roster of ${roster.length} actors to web app.`);
  pushToWebApp({ type: "roster", data: roster });

  // Start heartbeat loop so the web app knows Foundry is alive
  startHeartbeat();

  // Expose API for macros: game.modules.get("gluniverse-reactive-image").api.reconnect()
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { reconnect };
});

/**
 * On actor update: detect HP changes and push the new values to the web app.
 *
 * The `changed` object mirrors the document diff – we check whether the
 * configured HP paths are present anywhere in it.  Because the paths are
 * relative to `actor.system`, we look inside `changed.system`.
 */
Hooks.on("updateActor", (actor, changed, _options, _userId) => {
  // Only care about character actors
  if (actor.type !== "character") return;

  // Quick check: did the system data change at all?
  if (!changed.system) return;

  const hpPath = game.settings.get(MODULE_ID, "hpPath");
  const maxHpPath = game.settings.get(MODULE_ID, "maxHpPath");

  // Check if either HP-related path was touched in the diff
  const hpChanged = resolvePath(changed.system, hpPath) !== undefined;
  const maxHpChanged = resolvePath(changed.system, maxHpPath) !== undefined;

  if (!hpChanged && !maxHpChanged) return;

  const data = extractHpData(actor);
  if (!data) return;

  console.log(`${MODULE_ID} | HP changed for ${data.actorName}: ${data.hp}/${data.maxHp}`);
  pushToWebApp({ type: "hp", data });
});
