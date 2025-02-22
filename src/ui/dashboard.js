const blessed = require("blessed");
const contrib = require("blessed-contrib");
const { createWidgets, widgets, updateStatus } = require("./widgets");
const { log } = require("../utils");

let screen = null;

/**
 * @returns {Object}
 */
function initDashboard() {
  screen = blessed.screen({
    smartCSR: true,
    title: "KlokAI Chat Automation",
    cursor: {
      artificial: true,
      shape: "line",
      blink: true,
      color: "cyan",
    },
  });

  const grid = new contrib.grid({ rows: 14, cols: 12, screen: screen });

  const banner = grid.set(0, 0, 2, 12, blessed.box, {
    tags: true,
    content:
      "{center}{bold}Klok BOT{/bold}{/center}\n{center}Github: https://github.com/rpchubs | Telegram: https://t.me/RPC_Hubs{/center}",
    border: {
      type: "line",
    },
    style: {
      fg: "cyan",
      border: {
        fg: "blue",
      },
    },
  });

  createWidgets(grid, 2);

  setupKeyBindings();

  screen.program.hideCursor();
  screen.render();

  log("KlokAI Chat Automation Dashboard initialized", "success");
  updateStatus("Ready to start", "info");

  return screen;
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyBindings() {
  screen.key(["escape", "q", "C-c"], () => {
    return process.exit(0);
  });

  screen.key("h", () => {
    updateStatus("Keys: [S]tart [P]ause [R]esume [Q]uit [H]elp", "info");
    screen.render();

    setTimeout(() => {
      updateStatus("Ready", "info");
      screen.render();
    }, 5000);
  });
}

/**
 * @param {string} key
 * @param {Function} handler
 */
function registerKeyHandler(key, handler) {
  if (!screen) {
    throw new Error("Dashboard not initialized");
  }

  screen.key(key, handler);
}

/**
 * Render screen
 */
function render() {
  if (!screen) return;
  screen.render();
}

module.exports = {
  initDashboard,
  registerKeyHandler,
  render,
  screen,
};
