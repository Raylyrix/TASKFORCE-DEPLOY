import { createPortal } from "react-dom";

import { Button } from "./Button";

type LaunchStatus = "idle" | "running" | "paused" | "cancelled" | "completed" | "error";
type LaunchPhase =
  | "idle"
  | "creating"
  | "scheduling"
  | "followUps"
  | "monitoring"
  | "paused"
  | "cancelled"
  | "completed"
  | "error";

type LaunchLogEntry = {
  id: string;
  message: string;
  timestamp: string;
};

type CampaignLaunchProgressProps = {
  open: boolean;
  status: LaunchStatus;
  phase: LaunchPhase;
  percent: number;
  metrics: {
    totalRecipients: number;
    sentCount: number;
    opens: number;
    clicks: number;
    statusLabel?: string;
  } | null;
  logs: LaunchLogEntry[];
  error?: string;
  canPause: boolean;
  canStop: boolean;
  canClose: boolean;
  onPause?: () => void;
  onStop?: () => void;
  onClose: () => void;
};

const OVERLAY_ID = "taskforce-launch-progress";

const statusPalette: Record<
  LaunchStatus,
  { label: string; background: string; color: string; border: string }
> = {
  idle: { label: "Idle", background: "#e8eaed", color: "#3c4043", border: "#dadce0" },
  running: { label: "Running", background: "#e8f0fe", color: "#1a73e8", border: "#c3d4fd" },
  paused: { label: "Paused", background: "#fff4ce", color: "#8a6d3b", border: "#f4d490" },
  cancelled: { label: "Cancelled", background: "#fce8e6", color: "#c5221f", border: "#f6c3c3" },
  completed: { label: "Completed", background: "#e6f4ea", color: "#137333", border: "#c8e6c9" },
  error: { label: "Error", background: "#fce8e6", color: "#c5221f", border: "#f6c3c3" },
};

const phaseLabel: Record<LaunchPhase, string> = {
  idle: "Waiting to launch",
  creating: "Creating campaign",
  scheduling: "Scheduling delivery",
  followUps: "Saving follow-ups",
  monitoring: "Monitoring sends",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
  error: "Error",
};

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const CampaignLaunchProgress = ({
  open,
  status,
  phase,
  percent,
  metrics,
  logs,
  error,
  canPause,
  canStop,
  canClose,
  onPause,
  onStop,
  onClose,
}: CampaignLaunchProgressProps) => {
  if (!open) {
    return null;
  }

  let container = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!container) {
    container = document.createElement("div");
    container.id = OVERLAY_ID;
    document.body.appendChild(container);
  }

  const palette = statusPalette[status];

  const portal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 24px",
            borderBottom: "1px solid #e0e3e7",
            background: "linear-gradient(135deg, #1a73e8, #4285f4)",
            color: "#ffffff",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Launching campaign</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.85 }}>{phaseLabel[phase]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!canClose}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: canClose ? "#ffffff" : "rgba(255,255,255,0.6)",
              cursor: canClose ? "pointer" : "not-allowed",
              fontSize: "16px",
              padding: "6px 10px",
              borderRadius: "8px",
              transition: "opacity 0.2s ease",
            }}
          >
            Close
          </button>
        </header>

        <div
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                height: "10px",
                width: "100%",
                backgroundColor: "#e0e3e7",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, percent))}%`,
                  background: "linear-gradient(135deg, #1a73e8, #34a853)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#5f6368" }}>
              <span>{Math.round(percent)}% complete</span>
              <span>{phaseLabel[phase]}</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              padding: "12px",
              borderRadius: "12px",
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.background,
              color: palette.color,
              fontSize: "13px",
            }}
          >
            <strong style={{ fontSize: "13px" }}>{palette.label}</strong>
            {metrics ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: palette.color }}>
                <span style={{ opacity: 0.9 }}>
                  {metrics.sentCount} of {metrics.totalRecipients} sent · {metrics.opens} opens · {metrics.clicks} clicks
                </span>
                <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                  <span>✓ Sent {metrics.sentCount}</span>
                  <span>✓✓ Opened {metrics.opens}</span>
                  <span>✓✓ Clicked {metrics.clicks}</span>
                </div>
              </div>
            ) : (
              <span style={{ color: palette.color, opacity: 0.9 }}>Preparing campaign</span>
            )}
          </div>

          <div
            style={{
              border: "1px solid #e0e3e7",
              borderRadius: "12px",
              padding: "12px",
              backgroundColor: "#f8f9fa",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <strong style={{ fontSize: "13px", color: "#3c4043" }}>Activity</strong>
            {logs.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#5f6368" }}>No events yet.</span>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#3c4043",
                  maxHeight: "160px",
                  overflowY: "auto",
                }}
              >
                {logs
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li key={entry.id}>
                      <span style={{ color: "#5f6368" }}>{formatTimestamp(entry.timestamp)}</span> — {entry.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {error ? (
            <div
              style={{
                border: "1px solid #f6c3c3",
                borderRadius: "12px",
                padding: "12px",
                backgroundColor: "#fef3f2",
                color: "#c5221f",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderTop: "1px solid #e0e3e7",
            backgroundColor: "#ffffff",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#5f6368" }}>
            {metrics
              ? `${metrics.sentCount}/${metrics.totalRecipients} recipients processed`
              : "Preparing launch…"}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {canPause && onPause ? (
              <Button variant="secondary" onClick={onPause}>
                Pause
              </Button>
            ) : null}
            {canStop && onStop ? (
              <Button variant="secondary" onClick={onStop}>
                Stop
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose} disabled={!canClose}>
              {canClose ? "Close" : "Close (after finish)"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(portal, container);
};


