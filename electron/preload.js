"use strict";

/**
 * Preload — deliberately almost empty.
 *
 * The renderer is the untouched Next.js web app: no Node APIs, no privileged
 * bridge, context isolation on, sandbox on. The only thing the page cannot know
 * on its own is that it is running as a desktop app, which is exposed as a
 * read-only flag for future "open in Finder" style affordances.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("clipEngine", {
  isDesktop: true,
  platform: process.platform,
});
