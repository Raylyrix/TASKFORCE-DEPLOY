"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Clock, Mail, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

type LaunchStatus = "idle" | "running" | "paused" | "cancelled" | "completed" | "error";
type LaunchPhase = "idle" | "creating" | "scheduling" | "followUps" | "monitoring" | "paused" | "cancelled" | "completed" | "error";

type LaunchLogEntry = {
  id: string;
  message: string;
  timestamp: string;
};

interface CampaignLaunchProgressProps {
  campaignId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function CampaignLaunchProgress({
  campaignId,
  isOpen,
  onClose,
  onComplete,
}: CampaignLaunchProgressProps) {
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [percent, setPercent] = useState(0);
  const [metrics, setMetrics] = useState<{
    totalRecipients: number;
    sentCount: number;
    opens: number;
    clicks: number;
  } | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [logs, setLogs] = useState<LaunchLogEntry[]>([]);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    if (!isOpen || !campaignId || finalized) return;

    let intervalId: NodeJS.Timeout | null = null;

    const fetchMetrics = async () => {
      try {
        const summary = await api.campaigns.get(campaignId);
        const campaignMetrics = summary.summary || {
          total: 0,
          sent: 0,
          opened: 0,
          clicked: 0,
          failed: 0,
        };

        const totalRecipients = campaignMetrics.total;
        const sentCount = campaignMetrics.sent;
        const opens = campaignMetrics.opened;
        const clicks = campaignMetrics.clicked;

        setMetrics({
          totalRecipients,
          sentCount,
          opens,
          clicks,
        });

        // Calculate progress
        const ratio = totalRecipients > 0 ? sentCount / totalRecipients : 0;
        const dynamicPercent = totalRecipients
          ? Math.min(95, 60 + Math.round(ratio * 35))
          : percent;
        setPercent(Math.max(percent, dynamicPercent));

        // Update status based on campaign state
        if (summary.status === "CANCELLED") {
          setStatus("cancelled");
          setPhase("cancelled");
          setPercent(100);
          if (intervalId) clearInterval(intervalId);
          setFinalized(true);
          addLog("Campaign delivery halted.");
        } else if (summary.status === "PAUSED") {
          setStatus("paused");
          setPhase("paused");
        } else if (totalRecipients > 0 && sentCount >= totalRecipients) {
          setStatus("completed");
          setPhase("completed");
          setPercent(100);
          if (intervalId) clearInterval(intervalId);
          setFinalized(true);
          addLog("All recipients processed.");
          onComplete?.();
        } else {
          setStatus("running");
          setPhase("monitoring");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch delivery status.";
        addLog(`Status check failed: ${message}`);
      }
    };

    // Start monitoring
    setStatus("running");
    setPhase("monitoring");
    setPercent(60);
    addLog("Monitoring delivery progress…");
    fetchMetrics();

    // Poll every 5 seconds
    intervalId = setInterval(fetchMetrics, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, campaignId, finalized, percent, onComplete]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        message,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handlePause = async () => {
    if (!campaignId) return;
    try {
      await api.campaigns.pause(campaignId);
      setStatus("paused");
      setPhase("paused");
      addLog("Campaign paused.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to pause campaign.";
      addLog(`Error: ${message}`);
    }
  };

  const handleCancel = async () => {
    if (!campaignId) return;
    try {
      await api.campaigns.cancel(campaignId);
      setStatus("cancelled");
      setPhase("cancelled");
      setPercent(100);
      addLog("Campaign cancelled.");
      setFinalized(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel campaign.";
      addLog(`Error: ${message}`);
    }
  };

  if (!isOpen) return null;

  const canPause = status === "running";
  const canStop = status === "running" || status === "paused";
  const canClose = true; // Always allow closing

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Campaign Launch Progress</h2>
              <p className="text-blue-100 mt-1 text-sm">
                {phase === "monitoring" && "Tracking delivery in real-time"}
                {phase === "completed" && "Campaign completed successfully"}
                {phase === "paused" && "Campaign is paused"}
                {phase === "cancelled" && "Campaign was cancelled"}
                {phase === "error" && "An error occurred"}
              </p>
            </div>
            {canClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-700">{percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                status === "completed"
                  ? "bg-green-500"
                  : status === "error" || status === "cancelled"
                    ? "bg-red-500"
                    : status === "paused"
                      ? "bg-yellow-500"
                      : "bg-blue-600"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{metrics.totalRecipients}</div>
                <div className="text-xs text-gray-500 mt-1">Total Recipients</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{metrics.sentCount}</div>
                <div className="text-xs text-gray-500 mt-1">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{metrics.opens}</div>
                <div className="text-xs text-gray-500 mt-1">Opened</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{metrics.clicks}</div>
                <div className="text-xs text-gray-500 mt-1">Clicked</div>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="p-6 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Log</h3>
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-6 bg-red-50 border-t border-red-200">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 rounded-b-lg flex items-center justify-between">
          <div className="flex gap-2">
            {canPause && (
              <button
                onClick={handlePause}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Pause
              </button>
            )}
            {canStop && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Stop
              </button>
            )}
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

