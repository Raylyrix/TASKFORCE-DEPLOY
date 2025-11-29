import { createRoot, type Root } from "react-dom/client";

import { ComposerApp, FollowUpApp, BestPracticesApp } from "./App";
import { useExtensionStore } from "../shared/store";

const FLOATING_COMPOSER_ID = "taskforce-floating-composer";
const FLOATING_FOLLOWUPS_ID = "taskforce-floating-followups";
const FLOATING_BEST_PRACTICES_ID = "taskforce-floating-best-practices";
const STORAGE_KEY = "taskforce-floating-window-state";

type WindowConfig = {
  id: string;
  title: string;
  initialPosition: { x: number; y: number };
  initialSize: { width: number; height: number };
  defaultVisible?: boolean;
  sidebarLabel?: string;
  sidebarIcon?: string;
  allowMultiple?: boolean;
  contentId: string;
  render: (root: Root) => void;
};

type StoredWindowState = {
  instanceId: string;
  configId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  minimized: boolean;
  createdAt: number;
};

type ManagedWindow = {
  instanceId: string;
  config: WindowConfig;
  element: HTMLDivElement;
  header: HTMLDivElement;
  content: HTMLDivElement;
  root: Root;
  minimizeButton: HTMLButtonElement;
  isDragging: boolean;
  isResizing: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  resizeStartWidth: number;
  resizeStartHeight: number;
  resizeStartX: number;
  resizeStartY: number;
};

const windowConfigs: WindowConfig[] = [
  {
    id: FLOATING_COMPOSER_ID,
    title: "TaskForce Composer",
    initialPosition: { x: 80, y: 80 },
    initialSize: { width: 540, height: 720 },
    defaultVisible: true,
    sidebarLabel: "TaskForce Composer",
    sidebarIcon: "✉️",
    allowMultiple: true,
    contentId: "taskforce-floating-composer-content",
    render: (root, isFresh?: boolean) => root.render(<ComposerApp isFreshInstance={isFresh} />),
  },
  {
    id: FLOATING_FOLLOWUPS_ID,
    title: "TaskForce Follow-ups",
    initialPosition: { x: 660, y: 120 },
    initialSize: { width: 560, height: 720 },
    defaultVisible: false,
    sidebarLabel: "TaskForce Follow-ups",
    sidebarIcon: "🔁",
    allowMultiple: false,
    contentId: "taskforce-floating-followups-content",
    render: (root) => root.render(<FollowUpApp />),
  },
  {
    id: FLOATING_BEST_PRACTICES_ID,
    title: "Email Best Practices",
    initialPosition: { x: 200, y: 100 },
    initialSize: { width: 600, height: 700 },
    defaultVisible: false,
    sidebarLabel: "Best Practices",
    sidebarIcon: "📚",
    allowMultiple: false,
    contentId: "taskforce-floating-best-practices-content",
    render: (root) => root.render(<BestPracticesApp />),
  },
];

const configById = new Map(windowConfigs.map((config) => [config.id, config]));

let windowState: Record<string, StoredWindowState> = {};
const managedWindows: ManagedWindow[] = [];
const sidebarButtons: Record<string, HTMLButtonElement> = {};

let activeWindowId: string | null = null;

const refreshWindowElevation = (managed: ManagedWindow) => {
  const state = windowState[managed.instanceId];
  if (!state) {
    return;
  }

  if (state.minimized) {
    managed.element.style.boxShadow = "0 16px 34px rgba(15, 23, 42, 0.26)";
    managed.element.style.border = "1px solid rgba(26,115,232,0.22)";
    return;
  }

  if (activeWindowId === managed.instanceId) {
    managed.element.style.boxShadow = "0 32px 80px rgba(15, 23, 42, 0.36)";
    managed.element.style.border = "1px solid rgba(26,115,232,0.28)";
  } else {
    managed.element.style.boxShadow = "0 18px 48px rgba(15, 23, 42, 0.24)";
    managed.element.style.border = "1px solid rgba(60,64,67,0.18)";
  }
};

const activateWindow = (managed: ManagedWindow) => {
  const state = windowState[managed.instanceId];
  if (!state || state.minimized) {
    return;
  }

  activeWindowId = managed.instanceId;

  managedWindows.forEach((entry) => {
    if (entry.instanceId === managed.instanceId) {
      entry.element.classList.add("taskforce-window--active");
      document.body.appendChild(entry.element);
    } else {
      entry.element.classList.remove("taskforce-window--active");
    }
    refreshWindowElevation(entry);
  });
};

const focusFallbackWindow = () => {
  const fallback = [...managedWindows]
    .reverse()
    .find((entry) => {
      const state = windowState[entry.instanceId];
      return Boolean(state?.visible && !state.minimized);
    });

  if (fallback) {
    activateWindow(fallback);
  } else {
    activeWindowId = null;
    managedWindows.forEach((entry) => {
      entry.element.classList.remove("taskforce-window--active");
      refreshWindowElevation(entry);
    });
  }
};

const ensureAnimationStyles = () => {
  if (document.getElementById("taskforce-window-animations")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "taskforce-window-animations";
  style.textContent = `
@keyframes taskforce-window-pop {
  0% { opacity: 0; transform: translateY(48px) scale(0.92); }
  55% { opacity: 1; transform: translateY(-8px) scale(1.04); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes taskforce-window-minimize {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(24px) scale(0.94); opacity: 0.94; }
}
@keyframes taskforce-window-restore {
  0% { transform: translateY(24px) scale(0.94); opacity: 0.94; }
  55% { transform: translateY(-10px) scale(1.02); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes taskforce-spin {
  to { transform: rotate(360deg); }
}
.taskforce-spinner {
  animation: taskforce-spin 0.8s linear infinite;
}
@keyframes taskforce-window-dock-pulse {
  0%, 100% { transform: translateY(20px) scale(0.96); box-shadow: 0 14px 30px rgba(15, 23, 42, 0.22); }
  50% { transform: translateY(17px) scale(0.98); box-shadow: 0 20px 36px rgba(26, 115, 232, 0.28); }
}
.taskforce-window {
  transition:
    top 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    left 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    bottom 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    height 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
    border-radius 0.4s ease,
    opacity 0.28s ease,
    transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform-origin: 50% 50%;
  will-change: transform, top, left, bottom, width, height;
  backdrop-filter: saturate(160%) blur(18px);
}
.taskforce-window::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.4s ease, box-shadow 0.4s ease;
  pointer-events: none;
  box-shadow: 0 20px 48px rgba(26, 115, 232, 0.26);
}
.taskforce-window--active::before {
  opacity: 0.45;
}
.taskforce-window--hidden {
  opacity: 0;
  transform: translateY(28px) scale(0.94);
  pointer-events: none !important;
}
.taskforce-window--spawning {
  animation: taskforce-window-pop 0.58s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.taskforce-window--minimized {
  transform: translateY(20px) scale(0.96);
}
.taskforce-window--minimized::before {
  opacity: 0.28;
  box-shadow: 0 16px 34px rgba(26, 115, 232, 0.22);
}
.taskforce-window--minimized:hover::before {
  opacity: 0.38;
}
.taskforce-window--minimize-cue {
  animation: taskforce-window-minimize 0.46s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.taskforce-window--restore-cue {
  animation: taskforce-window-restore 0.52s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.taskforce-window--closing {
  animation: taskforce-window-minimize 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.taskforce-window--dragging,
.taskforce-window--resizing {
  transition: none;
}
.taskforce-window--dragging {
  transform: translateY(-6px) scale(1.02) !important;
}
.taskforce-window-header {
  background: linear-gradient(135deg, rgba(26, 115, 232, 0.92), rgba(66, 133, 244, 0.88));
  color: #ffffff;
  transition: background 0.45s ease, color 0.45s ease, box-shadow 0.45s ease;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.2);
}
.taskforce-window--active .taskforce-window-header {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(26, 115, 232, 0.95));
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.32);
}
.taskforce-window--minimized .taskforce-window-header {
  background: linear-gradient(135deg, rgba(26, 115, 232, 0.72), rgba(66, 133, 244, 0.65));
}
.taskforce-window-content {
  transition: opacity 0.35s ease, transform 0.48s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.taskforce-window--minimized .taskforce-window-content {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
  pointer-events: none;
}
.taskforce-window-controls button {
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.3s ease, box-shadow 0.3s ease;
  backdrop-filter: blur(4px);
}
.taskforce-window-controls button:hover {
  transform: translateY(-1px) scale(1.03);
  background: rgba(255, 255, 255, 0.35);
  box-shadow: 0 10px 24px rgba(26, 115, 232, 0.25);
}
`;
  document.head.appendChild(style);
};

const playWindowCue = (element: HTMLDivElement, cue: "minimize" | "restore") => {
  element.classList.remove("taskforce-window--minimize-cue", "taskforce-window--restore-cue");
  // Force reflow to restart animation.
  void element.getBoundingClientRect();
  element.classList.add(cue === "minimize" ? "taskforce-window--minimize-cue" : "taskforce-window--restore-cue");
  window.setTimeout(() => {
    element.classList.remove("taskforce-window--minimize-cue", "taskforce-window--restore-cue");
  }, 550);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDefaultEntry = (config: WindowConfig, instanceId = config.id): StoredWindowState => ({
  instanceId,
  configId: config.id,
  x: config.initialPosition.x,
  y: config.initialPosition.y,
  width: config.initialSize.width,
  height: config.initialSize.height,
  visible: config.defaultVisible ?? false,
  minimized: false,
  createdAt: Date.now(),
});

const sanitizeState = (config: WindowConfig, state: StoredWindowState): StoredWindowState => {
  const minWidth = 360;
  const minHeight = 260;
  const viewportWidth = Math.max(window.innerWidth, minWidth + 24);
  const viewportHeight = Math.max(window.innerHeight, minHeight + 120);

  const width = clamp(state?.width ?? config.initialSize.width, minWidth, viewportWidth - 24);
  const height = clamp(state?.height ?? config.initialSize.height, minHeight, viewportHeight - 120);

  const maxX = Math.max(12, viewportWidth - width - 12);
  const maxY = Math.max(60, viewportHeight - height - 24);

  const x = clamp(state?.x ?? config.initialPosition.x, 12, maxX);
  const y = clamp(state?.y ?? config.initialPosition.y, 60, maxY);

  return {
    instanceId: state?.instanceId ?? config.id,
    configId: config.id,
    x,
    y,
    width,
    height,
    visible: state?.visible ?? config.defaultVisible ?? false,
    minimized: state?.minimized ?? false,
    createdAt: state?.createdAt ?? Date.now(),
  };
};

const loadState = (): Record<string, StoredWindowState> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults: Record<string, StoredWindowState> = {};
      windowConfigs.forEach((config) => {
        const entry = getDefaultEntry(config);
        defaults[entry.instanceId] = entry;
      });
      return defaults;
    }
    const parsed = JSON.parse(raw) as StoredWindowState[];
    const next: Record<string, StoredWindowState> = {};

    parsed.forEach((entry) => {
      const config = configById.get(entry.configId);
      if (!config) return;
      const sanitized = sanitizeState(config, entry);
      next[sanitized.instanceId] = sanitized;
    });

    windowConfigs.forEach((config) => {
      const existing = Object.values(next).some((state) => state.configId === config.id);
      if (!existing) {
        const fallback = getDefaultEntry(config);
        next[fallback.instanceId] = fallback;
      }
    });

    return next;
  } catch {
    const defaults: Record<string, StoredWindowState> = {};
    windowConfigs.forEach((config) => {
      const entry = getDefaultEntry(config);
      defaults[entry.instanceId] = entry;
    });
    return defaults;
  }
};

const persistState = (state: Record<string, StoredWindowState>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(state)));
  } catch {
    // ignore write errors
  }
};

const findManagedWindow = (instanceId: string) =>
  managedWindows.find((entry) => entry.instanceId === instanceId);

const isConfigVisible = (configId: string) =>
  Object.values(windowState).some((entry) => entry.configId === configId && entry.visible);

const updateButtonState = (configId: string) => {
  const button = sidebarButtons[configId];
  if (!button) return;
  button.style.backgroundColor = isConfigVisible(configId) ? "#e8f0fe" : "transparent";
};

const updateWindowStateSnapshot = (instanceId: string, overrides: Partial<StoredWindowState> = {}) => {
  const state = windowState[instanceId];
  if (!state) return;
  const config = configById.get(state.configId);
  if (!config) return;
  const managed = findManagedWindow(instanceId);
  const element = managed?.element;

  const geometry =
    state.minimized || !element
      ? state
      : {
          ...state,
          x: element.offsetLeft,
          y: element.offsetTop,
          width: element.offsetWidth,
          height: element.offsetHeight,
        };

  const next = sanitizeState(config, {
    ...geometry,
    ...overrides,
    instanceId,
    configId: config.id,
  });

  windowState[instanceId] = next;
  persistState(windowState);
  updateButtonState(config.id);
};

const applyWindowLayout = (managed: ManagedWindow) => {
  const state = windowState[managed.instanceId];
  if (!state) return;

  const { element, minimizeButton, header } = managed;

  if (state.visible) {
    if (element.style.display !== "flex") {
      element.style.display = "flex";
      requestAnimationFrame(() => {
        element.classList.remove("taskforce-window--hidden");
      });
    } else {
      element.classList.remove("taskforce-window--hidden");
    }
  } else {
    element.classList.add("taskforce-window--hidden");
    window.setTimeout(() => {
      if (!windowState[managed.instanceId]?.visible) {
        element.style.display = "none";
      }
    }, 280);
  }

  if (!state.minimized) {
    element.classList.remove("taskforce-window--minimized");
    element.style.left = `${state.x}px`;
    element.style.top = `${state.y}px`;
    element.style.bottom = "";
    element.style.width = `${state.width}px`;
    element.style.height = `${state.height}px`;
    minimizeButton.textContent = "▁";
    minimizeButton.setAttribute("aria-label", "Minimize window");
    header.style.cursor = "grab";
  } else {
    element.classList.add("taskforce-window--minimized");
    element.style.top = "";
    element.style.bottom = "12px";
    element.style.height = "56px";
    const collapsedWidth = Math.max(320, Math.min(state.width, window.innerWidth - 24));
    element.style.width = `${collapsedWidth}px`;
    minimizeButton.textContent = "▢";
    minimizeButton.setAttribute("aria-label", "Restore window");
    header.style.cursor = "pointer";
  }

  refreshWindowElevation(managed);
};

const reflowMinimizedWindows = () => {
  const minimized = managedWindows
    .filter((managed) => {
      const state = windowState[managed.instanceId];
      return state?.visible && state.minimized;
    })
    .sort((a, b) => {
      const stateA = windowState[a.instanceId];
      const stateB = windowState[b.instanceId];
      return (stateA?.createdAt ?? 0) - (stateB?.createdAt ?? 0);
    });

  let offset = 12;
  minimized.forEach((managed) => {
    const state = windowState[managed.instanceId];
    if (!state) return;
    const collapsedWidth = Math.max(320, Math.min(state.width, window.innerWidth - 24));
    managed.element.style.left = `${offset}px`;
    managed.element.style.bottom = "12px";
    managed.element.style.top = "";
    offset += collapsedWidth + 12;
    refreshWindowElevation(managed);
  });
};

const setWindowVisibility = (instanceId: string, visible: boolean) => {
  const currentState = windowState[instanceId];
  if (!currentState) return;
  const previousVisible = currentState.visible;

  updateWindowStateSnapshot(instanceId, { visible });
  const managed = findManagedWindow(instanceId);
  if (!managed) return;

  if (!visible && previousVisible) {
    managed.element.classList.add("taskforce-window--closing");
  }

  applyWindowLayout(managed);

  const updatedState = windowState[instanceId];
  const isMinimized = updatedState?.minimized ?? false;

  if (visible) {
    if (!isMinimized) {
      activateWindow(managed);
    } else {
      managed.element.classList.remove("taskforce-window--active");
      refreshWindowElevation(managed);
    }
  }
  if (!visible && previousVisible) {
    managed.element.classList.remove("taskforce-window--active");
    refreshWindowElevation(managed);
    if (activeWindowId === instanceId) {
      activeWindowId = null;
      focusFallbackWindow();
    }
  }

  if (visible && !previousVisible) {
    playWindowCue(managed.element, "restore");
  }
  if (!visible && previousVisible) {
    window.setTimeout(() => {
      managed.element.classList.remove("taskforce-window--closing");
    }, 320);
  }

  const nextState = windowState[instanceId];
  if (visible && nextState && !nextState.minimized) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxX = Math.max(12, viewportWidth - nextState.width - 12);
    const maxY = Math.max(60, viewportHeight - nextState.height - 24);
    const clampedX = clamp(nextState.x, 12, maxX);
    const clampedY = clamp(nextState.y, 60, maxY);
    if (clampedX !== nextState.x || clampedY !== nextState.y) {
      updateWindowStateSnapshot(instanceId, { x: clampedX, y: clampedY });
      managed.element.style.left = `${clampedX}px`;
      managed.element.style.top = `${clampedY}px`;
    }
  }

  reflowMinimizedWindows();
};

const toggleWindowVisibility = (configId: string) => {
  const existing = Object.values(windowState).find((state) => state.configId === configId && state.visible);
  if (existing) {
    setWindowVisibility(existing.instanceId, false);
    return;
  }
  const config = configById.get(configId);
  if (!config) return;
  const existingState = Object.values(windowState).find((state) => state.configId === configId);
  if (existingState) {
    setWindowVisibility(existingState.instanceId, true);
  } else {
    spawnWindow(config);
  }
};

// Expose function to open windows from React components
(window as any).__taskforceOpenWindow = (configId: string) => {
  toggleWindowVisibility(configId);
};

const setWindowMinimized = (instanceId: string, minimized: boolean) => {
  const state = windowState[instanceId];
  if (!state) return;
  const previousMinimized = state.minimized;
  updateWindowStateSnapshot(instanceId, { minimized, visible: true });
  const managed = findManagedWindow(instanceId);
  if (!managed) return;
  if (previousMinimized !== minimized) {
    playWindowCue(managed.element, minimized ? "minimize" : "restore");
  }
  applyWindowLayout(managed);
  if (minimized) {
    managed.element.classList.remove("taskforce-window--active");
    refreshWindowElevation(managed);
    if (activeWindowId === instanceId) {
      activeWindowId = null;
      focusFallbackWindow();
    }
  } else {
    activateWindow(managed);
  }
  reflowMinimizedWindows();
};

const destroyWindow = (instanceId: string) => {
  const index = managedWindows.findIndex((entry) => entry.instanceId === instanceId);
  if (index === -1) return;
  const managed = managedWindows[index];
  managed.root.unmount();
  managed.element.remove();
  managedWindows.splice(index, 1);
  if (activeWindowId === instanceId) {
    activeWindowId = null;
  }
  delete windowState[instanceId];
  persistState(windowState);
  updateButtonState(managed.config.id);
  reflowMinimizedWindows();
  focusFallbackWindow();
};

const spawnWindow = (config: WindowConfig, base?: StoredWindowState) => {
  const offset = 32;
  const isNewComposer = base?.instanceId && base.instanceId !== config.id;
  const instanceId =
    isNewComposer
      ? `${base.instanceId}-clone`
      : `${config.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const startState = sanitizeState(config, {
    ...(base ?? getDefaultEntry(config)),
    instanceId,
    configId: config.id,
    visible: true,
    minimized: false,
    x: (base?.x ?? config.initialPosition.x) + offset,
    y: (base?.y ?? config.initialPosition.y) + offset,
    createdAt: Date.now(),
  });

  windowState[instanceId] = startState;
  persistState(windowState);
  
  // If this is a new composer (spawned via plus button), mark it as fresh
  // This flag will be checked when the store initializes to prevent loading cached draft
  const isFresh = isNewComposer && config.id === FLOATING_COMPOSER_ID;
  if (isFresh) {
    try {
      window.sessionStorage.setItem("taskforce-fresh-instance-flag", "true");
    } catch (error) {
      console.warn("[TaskForce] Failed to set fresh instance flag", error);
    }
  }
  
  createWindowInstance(config, startState, isFresh);
  setWindowVisibility(instanceId, true);
};

const createWindowInstance = (config: WindowConfig, state: StoredWindowState, isFresh?: boolean) => {
  const existing = document.getElementById(state.instanceId) as HTMLDivElement | null;
  if (existing) {
    existing.remove();
  }

  ensureAnimationStyles();

  const container = document.createElement("div");
  container.id = state.instanceId;
  container.classList.add("taskforce-window");
  if (!state.visible) {
    container.classList.add("taskforce-window--hidden");
  }
  Object.assign(container.style, {
    position: "fixed",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: "18px",
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.24)",
    border: "1px solid rgba(60,64,67,0.18)",
    display: state.visible ? "flex" : "none",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: "2147483646",
    transform: "translateZ(0)",
    cursor: "default",
    userSelect: "none",
    pointerEvents: "auto", // Ensure window can receive pointer events
  });
  if (state.visible) {
    requestAnimationFrame(() => {
      container.classList.add("taskforce-window--spawning");
      container.classList.remove("taskforce-window--hidden");
      window.setTimeout(() => {
        container.classList.remove("taskforce-window--spawning");
      }, 600);
    });
  }

  const header = document.createElement("div");
  header.classList.add("taskforce-window-header");
  Object.assign(header.style, {
    display: "flex",
    pointerEvents: "auto", // Ensure header can receive pointer events
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    fontSize: "14px",
    fontWeight: "600",
  });

  const title = document.createElement("span");
  title.textContent = config.title;
  header.appendChild(title);

  const controls = document.createElement("div");
  controls.classList.add("taskforce-window-controls");
  Object.assign(controls.style, {
    display: "flex",
    gap: "8px",
    pointerEvents: "auto", // Ensure controls can receive pointer events
    position: "relative",
    zIndex: "2147483647", // Ensure controls are on top
  });

  if (config.allowMultiple && state.instanceId === config.id) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "＋";
    button.title = "Open another composer";
    Object.assign(button.style, {
      border: "none",
      background: "rgba(255,255,255,0.2)",
      color: "#fff",
      padding: "6px 10px",
      borderRadius: "8px",
      cursor: "pointer",
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      spawnWindow(config, windowState[state.instanceId]);
    });
    controls.appendChild(button);
  }

  const minimizeButton = document.createElement("button");
  minimizeButton.type = "button";
  minimizeButton.textContent = "▁";
  minimizeButton.setAttribute("aria-label", "Minimize window");
  Object.assign(minimizeButton.style, {
    border: "none",
    background: "rgba(255,255,255,0.18)",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "9px",
    cursor: "pointer",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
    pointerEvents: "auto",
    position: "relative",
    zIndex: "2147483647",
  });
  controls.appendChild(minimizeButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "✕";
  closeButton.setAttribute("aria-label", "Close window");
  Object.assign(closeButton.style, {
    border: "none",
    background: "rgba(255,255,255,0.18)",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "9px",
    cursor: "pointer",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
    pointerEvents: "auto",
    position: "relative",
    zIndex: "2147483647",
  });
  controls.appendChild(closeButton);

  header.appendChild(controls);
  container.appendChild(header);

  const content = document.createElement("div");
  content.classList.add("taskforce-window-content");
  content.id =
    state.instanceId === config.id
      ? config.contentId
      : `${config.contentId}-${state.instanceId}`;
  Object.assign(content.style, {
    flex: "1",
    overflow: "auto",
    padding: "20px",
    backgroundColor: "#ffffff",
    pointerEvents: "auto", // Ensure content can receive pointer events
    scrollBehavior: "smooth", // Smooth scrolling
    userSelect: "text", // Allow text selection in content (buttons need this)
    WebkitUserSelect: "text", // Safari
    position: "relative", // Ensure proper stacking
    zIndex: "1", // Ensure content is above container background
  });
  
  // Prevent scroll-to-top on button clicks - but don't block the click itself
  // Use capture: false and passive: true so React handlers work properly
  // Only handle scroll preservation, don't interfere with button clicks
  content.addEventListener("click", (e) => {
    // Only handle scroll preservation, let React handle all button clicks
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      // Maintain scroll position after button clicks
      // Use setTimeout to ensure this runs after React handlers
      setTimeout(() => {
        const scrollTop = content.scrollTop;
        requestAnimationFrame(() => {
          if (content.scrollTop !== scrollTop) {
            content.scrollTop = scrollTop;
          }
        });
      }, 0);
    }
  }, { capture: false, passive: true });
  
  container.appendChild(content);

  const resizeHandle = document.createElement("div");
  resizeHandle.classList.add("taskforce-resize-handle");
  Object.assign(resizeHandle.style, {
    position: "absolute",
    width: "20px",
    height: "20px",
    bottom: "0px",
    right: "0px",
    borderRadius: "0 0 12px 0",
    background: "linear-gradient(135deg, rgba(26,115,232,0.85), rgba(66,133,244,0.75))",
    boxShadow: "0 2px 8px rgba(26,115,232,0.35), inset 0 0 0 1px rgba(255,255,255,0.3)",
    cursor: "nwse-resize",
    pointerEvents: "auto",
    zIndex: "2147483647",
    transition: "background 0.2s ease, opacity 0.2s ease",
    opacity: "0.9",
  });
  
  // Add hover effect
  resizeHandle.addEventListener("mouseenter", () => {
    resizeHandle.style.opacity = "1";
    resizeHandle.style.background = "linear-gradient(135deg, rgba(26,115,232,1), rgba(66,133,244,0.9))";
  });
  resizeHandle.addEventListener("mouseleave", () => {
    resizeHandle.style.opacity = "0.9";
    resizeHandle.style.background = "linear-gradient(135deg, rgba(26,115,232,0.85), rgba(66,133,244,0.75))";
  });
  
  container.appendChild(resizeHandle);

  document.body.appendChild(container);

  let root: Root;
  try {
    root = createRoot(content);
    config.render(root, isFresh);
    console.log(`[TaskForce] Window "${config.title}" rendered successfully`);
  } catch (error) {
    console.error(`[TaskForce] Failed to render window "${config.title}":`, error);
    content.innerHTML = `
      <div style="padding: 20px; color: #b3261e;">
        <strong>Error loading extension</strong>
        <p style="font-size: 12px; margin-top: 8px;">${error instanceof Error ? error.message : String(error)}</p>
        <p style="font-size: 11px; margin-top: 8px; color: #5f6368;">Check the browser console for details.</p>
      </div>
    `;
    // Create a dummy root if rendering failed so the managed object is valid
    root = createRoot(content);
  }

  const managed: ManagedWindow = {
    instanceId: state.instanceId,
    config,
    element: container,
    header,
    content,
    root,
    minimizeButton,
    isDragging: false,
    isResizing: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    resizeStartWidth: 0,
    resizeStartHeight: 0,
    resizeStartX: 0,
    resizeStartY: 0,
  };

  managedWindows.push(managed);

  // Only activate window on container background clicks, not on content or controls
  // Use capture: false so content clicks aren't intercepted
  container.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    // Don't activate if clicking on controls, content, or any interactive element
    if (target.closest(".taskforce-window-controls") || 
        target.closest(".taskforce-window-content") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a") ||
        target.closest("[role='button']")) {
      return;
    }
    const state = windowState[managed.instanceId];
    if (!state?.visible || state.minimized) {
      return;
    }
    activateWindow(managed);
  }, { capture: false });

  header.addEventListener("mousedown", (event) => {
    // Don't start drag if clicking on controls or any interactive element
    const target = event.target as HTMLElement;
    if (target.closest(".taskforce-window-controls") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a")) {
      return;
    }
    if (event.button !== 0) return;
    const currentState = windowState[managed.instanceId];
    if (currentState?.minimized) {
      setWindowMinimized(managed.instanceId, false);
      return;
    }
    activateWindow(managed);
    managed.isDragging = true;
    managed.dragOffsetX = event.clientX - container.offsetLeft;
    managed.dragOffsetY = event.clientY - container.offsetTop;
    header.style.cursor = "grabbing";
    container.style.cursor = "grabbing";
    container.classList.add("taskforce-window--dragging");
    event.preventDefault();
    event.stopPropagation();
  }, { capture: false }); // Use bubble phase so content clicks aren't blocked

  resizeHandle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    const currentState = windowState[managed.instanceId];
    if (currentState?.minimized) return;
    activateWindow(managed);
    managed.isResizing = true;
    managed.resizeStartWidth = container.offsetWidth;
    managed.resizeStartHeight = container.offsetHeight;
    managed.resizeStartX = event.clientX;
    managed.resizeStartY = event.clientY;
    event.preventDefault();
    event.stopPropagation();
    container.classList.add("taskforce-window--resizing");
  });

  minimizeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const currentState = windowState[managed.instanceId];
    setWindowMinimized(managed.instanceId, !(currentState?.minimized ?? false));
  });

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (config.allowMultiple && managed.instanceId !== config.id) {
      destroyWindow(managed.instanceId);
      return;
    }
    setWindowVisibility(managed.instanceId, false);
  });

  applyWindowLayout(managed);
  if (state.visible) {
    if (state.minimized) {
      refreshWindowElevation(managed);
    } else {
      activateWindow(managed);
    }
  } else {
    refreshWindowElevation(managed);
  }
  reflowMinimizedWindows();
  updateButtonState(config.id);
};

const initFloatingWindows = () => {
  try {
    windowState = loadState();
    Object.values(windowState)
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((state) => {
        try {
          const config = configById.get(state.configId);
          if (!config) {
            console.warn(`[TaskForce] Config not found for ${state.configId}`);
            return;
          }
          createWindowInstance(config, state);
        } catch (error) {
          console.error(`[TaskForce] Error creating window instance ${state.instanceId}:`, error);
        }
      });
    reflowMinimizedWindows();
  } catch (error) {
    console.error("[TaskForce] Error initializing floating windows:", error);
  }
};

const ensureSidebarButtons = () => {
  try {
    const nav = document.querySelector('div[role="navigation"]');
    if (!nav) return;

  const listContainer = nav.querySelector('div[role="list"]') ?? nav;
  const insertionPoint = nav.querySelector('div[role="tree"]');

  windowConfigs.forEach((config) => {
    if (!config.sidebarLabel) return;
    const wrapperId = `${config.id}-sidebar-wrapper`;
    if (document.getElementById(wrapperId)) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = wrapperId;
    Object.assign(wrapper.style, {
      margin: "12px 0",
      padding: "0 8px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      gap: "6px",
      alignItems: "center",
    });

    const button = document.createElement("button");
    button.id = `${config.id}-sidebar-button`;
    button.type = "button";
    button.textContent = config.sidebarLabel;
    button.setAttribute("aria-label", config.sidebarLabel);
    Object.assign(button.style, {
      flex: "1",
      border: "none",
      background: "transparent",
      padding: "10px 12px",
      borderRadius: "16px",
      textAlign: "left",
      fontSize: "14px",
      cursor: "pointer",
      color: "#1f1f1f",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      transition: "background-color 0.2s ease",
    });

    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "#e8f0fe";
    });
    button.addEventListener("mouseleave", () => {
      updateButtonState(config.id);
    });

    button.addEventListener("click", () => {
      toggleWindowVisibility(config.id);
    });

    const icon = document.createElement("span");
    icon.textContent = config.sidebarIcon ?? "⚙️";
    icon.setAttribute("aria-hidden", "true");
    icon.style.fontSize = "16px";
    button.prepend(icon);

    row.appendChild(button);
    sidebarButtons[config.id] = button;
    updateButtonState(config.id);

    if (config.allowMultiple) {
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.textContent = "＋";
      addButton.title = `Open another ${config.title}`;
      Object.assign(addButton.style, {
        border: "none",
        background: "#e8f0fe",
        color: "#1a73e8",
        padding: "8px 10px",
        borderRadius: "12px",
        cursor: "pointer",
        fontSize: "14px",
      });
      addButton.addEventListener("click", (event) => {
        event.stopPropagation();
        spawnWindow(config, windowState[config.id]);
      });
      row.appendChild(addButton);
    }

    wrapper.appendChild(row);

    if (insertionPoint && insertionPoint.parentElement) {
      insertionPoint.parentElement.insertBefore(wrapper, insertionPoint.nextSibling);
    } else {
      listContainer.appendChild(wrapper);
    }
  });
  } catch (error) {
    console.error("[TaskForce] Error ensuring sidebar buttons:", error);
  }
};

const init = () => {
  try {
    if (!window.location.host.includes("mail.google.com")) {
      console.warn("[TaskForce] Not on Gmail, skipping initialization");
      return;
    }

    console.log("[TaskForce] Initializing extension on Gmail...");
    
    initFloatingWindows();
    ensureSidebarButtons();
    
    // Initialize Gmail tracking indicators
    import("./gmailTracking").then(({ initGmailTracking }) => {
      initGmailTracking().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Extension context invalidated") || 
            errorMessage.includes("message port closed")) {
          console.warn("[TaskForce] Extension context invalidated, tracking will resume after page reload");
        } else {
          console.error("[TaskForce] Error initializing Gmail tracking:", error);
        }
      });
    });

    const observer = new MutationObserver(() => {
      try {
        ensureSidebarButtons();
      } catch (error) {
        console.error("[TaskForce] Error in sidebar button observer:", error);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Global mouse event handlers for drag and resize
    window.addEventListener("mousemove", (event) => {
      managedWindows.forEach((managed) => {
        if (managed.isDragging) {
          const x = Math.max(12, event.clientX - managed.dragOffsetX);
          const y = Math.max(60, event.clientY - managed.dragOffsetY);
          const maxX = window.innerWidth - managed.element.offsetWidth - 12;
          const maxY = window.innerHeight - managed.element.offsetHeight - 12;
          managed.element.style.left = `${Math.min(x, maxX)}px`;
          managed.element.style.top = `${Math.min(y, maxY)}px`;
        }
        if (managed.isResizing) {
          const width = Math.max(360, Math.min(window.innerWidth - 24, managed.resizeStartWidth + (event.clientX - managed.resizeStartX)));
          const height = Math.max(260, Math.min(window.innerHeight - 24, managed.resizeStartHeight + (event.clientY - managed.resizeStartY)));
          managed.element.style.width = `${width}px`;
          managed.element.style.height = `${height}px`;
        }
      });
    });

    window.addEventListener("mouseup", () => {
      managedWindows.forEach((managed) => {
        if (managed.isDragging) {
          managed.isDragging = false;
          managed.header.style.cursor = "grab";
          managed.element.style.cursor = "";
          managed.element.classList.remove("taskforce-window--dragging");
          updateWindowStateSnapshot(managed.instanceId);
          refreshWindowElevation(managed);
        }
        if (managed.isResizing) {
          managed.isResizing = false;
          managed.element.classList.remove("taskforce-window--resizing");
          updateWindowStateSnapshot(managed.instanceId);
          refreshWindowElevation(managed);
        }
      });
    });

    window.addEventListener("resize", () => {
      try {
        managedWindows.forEach((managed) => {
          if (!windowState[managed.instanceId]?.visible) return;
          if (windowState[managed.instanceId]?.minimized) {
            applyWindowLayout(managed);
          } else {
            updateWindowStateSnapshot(managed.instanceId);
            applyWindowLayout(managed);
          }
        });
        reflowMinimizedWindows();
      } catch (error) {
        console.error("[TaskForce] Error in resize handler:", error);
      }
    });

    console.log("[TaskForce] Extension initialized successfully");
  } catch (error) {
    console.error("[TaskForce] Fatal error during initialization:", error);
  }
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
