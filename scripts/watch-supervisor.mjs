#!/usr/bin/env node
/**
 * Keeps scripts/watch.mjs alive for a long unattended run.
 *
 * The watcher itself already survives ffmpeg crashes, but nothing restarts it
 * if the Node process is killed or the machine wakes from sleep badly. This
 * supervisor starts it, restarts it with backoff when it exits, and stops for
 * good on SIGINT/SIGTERM so `pkill -f watch-supervisor` is the only thing you
 * need to stop the whole thing.
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);
const LOG = process.env.WATCH_SUPERVISOR_LOG || "/tmp/se-watch.out";
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

let child = null;
let stopping = false;
let restarts = 0;
let delay = BASE_DELAY_MS;

function log(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] supervisor: ${line}\n`;
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, text);
  } catch {
    /* logging is best effort */
  }
  process.stdout.write(text);
}

function start() {
  if (stopping) return;
  const startedAt = Date.now();
  child = spawn(process.execPath, [join(HERE, "watch.mjs")], {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      log("child exited during shutdown");
      return;
    }
    const livedMs = Date.now() - startedAt;
    // A run that lasted a while means the restart succeeded; reset the backoff
    // so one bad patch does not leave the next restart waiting a full minute.
    if (livedMs > 120_000) delay = BASE_DELAY_MS;
    restarts += 1;
    log(`child exited (${signal || code}) after ${Math.round(livedMs / 1000)}s — restarting in ${Math.round(delay / 1000)}s (restart ${restarts})`);
    const wait = delay;
    delay = Math.min(MAX_DELAY_MS, delay * 2);
    setTimeout(start, wait);
  });

  log(`started child pid ${child.pid}`);
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal} — stopping child and supervisor`);
  if (child) {
    try { child.kill("SIGTERM"); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("uncaughtException", (err) => log(`uncaught exception — ${String(err?.message || err)}`));

start();
