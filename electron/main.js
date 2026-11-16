"use strict";

/**
 * Street Ethics Clip Engine — Electron main process.
 *
 * The renderer is the real Next.js app in `output: "standalone"` mode, so the
 * desktop build and the deployed build run identical code. This file's only job
 * is: point the app at a writable data directory, start the Next server on a
 * free loopback port, open a window on it, and shut the server down on quit.
 */

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

/** Packaged: server tree sits next to main.js. Dev: fall back to the repo build. */
const SERVER_DIR = app.isPackaged
  ? path.join(__dirname, "server")
  : path.join(__dirname, "..", ".next", "standalone");

/**
 * Set before `app.whenReady()`. Chromium derives the userData path from the app
 * name during startup, so calling this later can leave the data directory under
 * the staging package name (`street-ethics-clip-engine`) instead of the name the
 * user sees in Application Support.
 */
app.setName("Street Ethics Clip Engine");

let serverProcess = null;
let mainWindow = null;
let quitting = false;

/** Ask the OS for a free ephemeral port so two copies can never collide. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Read-or-create the session seal. Kept in userData so it survives upgrades and
 * is unique per machine, rather than shipping one shared secret inside the app.
 */
function sessionSecret() {
  const file = path.join(app.getPath("userData"), "session.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof parsed.sessionSecret === "string" && parsed.sessionSecret.length >= 32) {
      return parsed.sessionSecret;
    }
  } catch {
    /* missing or corrupt: regenerate below */
  }
  const secret = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ sessionSecret: secret }, null, 2), { mode: 0o600 });
  return secret;
}

/**
 * Wait until the server answers HTTP. Connecting alone can succeed before Next
 * has finished booting, which would show the user a blank window.
 */
function waitForServer(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/login", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Next server did not respond on port ${port} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function startServer(port) {
  const serverEntry = path.join(SERVER_DIR, "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Server bundle missing at ${serverEntry}. Run the packaging script.`);
  }

  /** Strip cloud config so the desktop build always uses local disk, never a remote DB. */
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  delete env.BLOB_READ_WRITE_TOKEN;
  delete env.VERCEL;
  delete env.MCP_API_TOKEN;

  Object.assign(env, {
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    SESSION_SECRET: sessionSecret(),
    LOCAL_AUTH_BYPASS: "1",
    CLIPMVP_DATA_DIR: path.join(app.getPath("userData"), "data"),
    FFMPEG_PATH: process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg",
    FFPROBE_PATH: process.env.FFPROBE_PATH || "/opt/homebrew/bin/ffprobe",
    // Run Electron's bundled Node, not a system node that may be missing.
    ELECTRON_RUN_AS_NODE: "1",
  });

  fs.mkdirSync(env.CLIPMVP_DATA_DIR, { recursive: true });

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: SERVER_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[next:err] ${d}`));
  serverProcess.on("exit", (code) => {
    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        "The clip engine stopped",
        `The local server exited with code ${code}. Quit and reopen the app.`
      );
    }
  });
}

function stopServer() {
  quitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: "#0B0B0E",
    title: "Street Ethics Clip Engine",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  // External links open in the real browser; the app window never navigates away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const port = await findFreePort();
    startServer(port);
    await waitForServer(port);
    createWindow(port);
  } catch (err) {
    dialog.showErrorBox("Clip engine failed to start", String(err && err.message ? err.message : err));
    app.quit();
    return;
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        const port = await findFreePort();
        startServer(port);
        await waitForServer(port);
        createWindow(port);
      } catch {
        /* already reported on first launch */
      }
    }
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);
process.on("exit", stopServer);
