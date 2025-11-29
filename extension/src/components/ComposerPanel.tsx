import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { formatISO, addMinutes } from "date-fns";

import { apiClient } from "../shared/apiClient";
import type { SheetImportResult } from "../shared/types";
import { Button } from "./Button";
import { Card } from "./Card";
import { useExtensionStore } from "../shared/store";
import { FloatingPreviewCard } from "./FloatingPreviewCard";
import { FollowUpOverlay } from "./FollowUpOverlay";
import { MergeFieldAutocomplete } from "./MergeFieldAutocomplete";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";
import { CampaignLaunchProgress } from "./CampaignLaunchProgress";
import { useSchedulerBootstrap } from "../hooks/useSchedulerBootstrap";
import { MeetingTypePicker } from "./MeetingTypePicker";

type ComposerPanelProps = {
  onCampaignCreated: () => Promise<unknown>;
};

const initialStartAt = () => formatISO(addMinutes(new Date(), 5));
const MERGE_FIELD_REGEX = /{{\s*([^}]+)\s*}}/g;

type StepId = "audience" | "email" | "schedule" | "review";

type StepConfig = {
  id: StepId;
  title: string;
  description: string;
};

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

type LaunchStatus = "idle" | "running" | "paused" | "cancelled" | "completed" | "error";

type LaunchLogEntry = {
  id: string;
  message: string;
  timestamp: string;
};

type LaunchMonitorState = {
  open: boolean;
  status: LaunchStatus;
  phase: LaunchPhase;
  percent: number;
  campaignId?: string;
  metrics: {
    totalRecipients: number;
    sentCount: number;
    opens: number;
    clicks: number;
    statusLabel?: string;
  } | null;
  error?: string;
  logs: LaunchLogEntry[];
  finalized: boolean;
};

const generateLaunchLogId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createInitialLaunchMonitor = (): LaunchMonitorState => ({
  open: false,
  status: "idle",
  phase: "idle",
  percent: 0,
  campaignId: undefined,
  metrics: null,
  error: undefined,
  logs: [],
  finalized: false,
});

type RecipientRecord = Record<string, string>;

const normalizeRecord = (record: RecipientRecord) => {
  const normalized: RecipientRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    normalized[key] = value;
    normalized[key.trim()] = value;
  });
  return normalized;
};

const renderTemplate = (template: string, record: RecipientRecord) =>
  template.replace(MERGE_FIELD_REGEX, (_, key: string) => record[key] ?? record[key.trim()] ?? "");

const toLocalDateTimeInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section
    style={{
      border: "1px solid #e8eaed",
      borderRadius: "12px",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "20px",
      backgroundColor: "#fff",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
    }}
  >
    <header>
      <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "#202124", lineHeight: "1.4", letterSpacing: "-0.01em" }}>{title}</h3>
      {description ? (
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5f6368", lineHeight: "1.5" }}>{description}</p>
      ) : null}
    </header>
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>{children}</div>
  </section>
);

const StepIndicator = ({
  steps,
  currentIndex,
  isStepComplete,
  canAccessStep,
  onStepClick,
}: {
  steps: StepConfig[];
  currentIndex: number;
  isStepComplete: (stepId: StepId) => boolean;
  canAccessStep: (index: number) => boolean;
  onStepClick: (index: number) => void;
}) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
    {steps.map((step, index) => {
      const complete = isStepComplete(step.id);
      const active = index === currentIndex;
      const accessible = canAccessStep(index);

      return (
        <button
          key={step.id}
          type="button"
          onClick={() => onStepClick(index)}
          disabled={!accessible}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "12px",
            border: `1px solid ${active ? "#1a73e8" : "rgba(0,0,0,0.12)"}`,
            backgroundColor: active ? "#e8f0fe" : "#ffffff",
            cursor: accessible ? "pointer" : "default",
            opacity: accessible ? 1 : 0.6,
            transition: "transform 0.15s ease",
          }}
        >
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              backgroundColor: complete || active ? "#1a73e8" : "#e8eaed",
              color: complete || active ? "#ffffff" : "#5f6368",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "13px",
              flexShrink: 0,
            }}
          >
            {complete ? "✓" : index + 1}
          </span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: active ? 600 : 500, color: "#202124", lineHeight: "1.4" }}>{step.title}</div>
            <div style={{ fontSize: "12px", color: "#5f6368", lineHeight: "1.4", marginTop: "2px" }}>{step.description}</div>
          </div>
        </button>
      );
    })}
  </div>
);

const chipStyles: Record<"info" | "success" | "warning", { background: string; color: string; border: string }> = {
  info: { background: "#e8f0fe", color: "#1a73e8", border: "#c3d4fd" },
  success: { background: "#e6f4ea", color: "#137333", border: "#c8e6c9" },
  warning: { background: "#fce8e6", color: "#c5221f", border: "#f8bfbf" },
};

const StatusChip = ({ label, tone = "info" }: { label: string; tone?: "info" | "success" | "warning" }) => {
  const palette = chipStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: palette.background,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
    >
      {label}
    </span>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "12px",
      fontSize: "13px",
    }}
  >
    <span style={{ color: "#5f6368" }}>{label}</span>
    <span style={{ color: "#1f1f1f", fontWeight: 600, textAlign: "right" }}>{value}</span>
  </div>
);

const findMergeFields = (template: string) => {
  const matches = template.matchAll(/{{\s*([^}]+)\s*}}/g);
  const tokens = new Set<string>();
  for (const match of matches) {
    const token = match[1]?.trim();
    if (token) {
      tokens.add(token);
    }
  }
  return Array.from(tokens);
};

export const ComposerPanel = ({ onCampaignCreated }: ComposerPanelProps) => {
  useSchedulerBootstrap();
  const composerDraft = useExtensionStore((state) => state.composerDraft);
  const updateComposerDraft = useExtensionStore((state) => state.updateComposerDraft);
  const openFollowUpOverlay = useExtensionStore((state) => state.openFollowUpOverlay);
  const closeFollowUpOverlay = useExtensionStore((state) => state.closeFollowUpOverlay);
  const updateFollowUpDraft = useExtensionStore((state) => state.updateFollowUpDraft);
  const backendUrl = useExtensionStore((state) => state.backendUrl);
  const resetComposerDraft = useExtensionStore((state) => state.resetComposerDraft);

  const {
    campaignName,
    sheetUrl,
    headerRowIndex,
    importResult,
    emailField,
    subjectTemplate,
    bodyTemplate,
    startAt,
    delayMsBetweenEmails,
    trackOpens,
    trackClicks,
    followUpSequence,
    lastSavedAt,
  } = composerDraft;

  const savedAtDate = lastSavedAt ? new Date(lastSavedAt) : null;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const saveMessageTimeoutRef = useRef<number | null>(null);
  const richTextEditorRef = useRef<RichTextEditorHandle | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteEnabled = composerDraft.autocompleteEnabled ?? true;
  const [subjectAutocompleteState, setSubjectAutocompleteState] = useState<{
    open: boolean;
    anchorRect: DOMRect | null;
    filtered: string[];
    selectedIndex: number;
    tokenStart: number;
    caretIndex: number;
  }>({
    open: false,
    anchorRect: null,
    filtered: [],
    selectedIndex: 0,
    tokenStart: 0,
    caretIndex: 0,
  });

  const [launchMonitor, setLaunchMonitor] = useState<LaunchMonitorState>(createInitialLaunchMonitor);
  const monitorIntervalRef = useRef<number | null>(null);
  const launchFinalizedRef = useRef(false);

  const clearMonitorInterval = () => {
    if (monitorIntervalRef.current) {
      window.clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearMonitorInterval();
    },
    [],
  );

  const appendLaunchLog = (message: string) => {
    setLaunchMonitor((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: generateLaunchLogId(),
          message,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  };

  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current) {
        window.clearTimeout(saveMessageTimeoutRef.current);
      }
    };
  }, []);

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.request<SheetImportResult>("/api/sheets/import", {
        method: "POST",
        body: JSON.stringify({
          sheetUrl,
          headerRowIndex,
        }),
      });
      return response;
    },
    onSuccess: (result) => {
      const defaultEmailField =
        result.headers.find((header) => header.toLowerCase().includes("email")) ??
        result.headers[0] ??
        "";
      updateComposerDraft({ importResult: result, emailField: defaultEmailField });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!importResult) {
        throw new Error("Import recipients before creating a campaign.");
      }
      if (!emailField) {
        throw new Error("Select the column that contains recipient email addresses.");
      }

      const campaignResponse = await apiClient.request<{ campaign: { id: string } }>(
        "/api/campaigns",
        {
          method: "POST",
          body: JSON.stringify({
            name: campaignName,
            sheetSourceId: importResult.sheetSource.id,
            recipients: {
              emailField,
              rows: importResult.records,
            },
            strategy: {
              startAt,
              delayMsBetweenEmails,
              trackOpens,
              trackClicks,
              template: {
                subject: subjectTemplate,
                html: bodyTemplate,
              },
            },
          }),
        },
      );

      return campaignResponse.campaign.id;
    },
  });

  const finalizeAfterLaunch = async (outcome: "completed" | "cancelled") => {
    if (launchFinalizedRef.current) {
      return;
    }
    launchFinalizedRef.current = true;
    try {
      await onCampaignCreated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh campaigns.";
      appendLaunchLog(`Refresh warning: ${message}`);
    }
    appendLaunchLog(
      outcome === "completed"
        ? "Campaign finished delivering. Draft preserved — review metrics or tweak before relaunch."
        : "Campaign cancelled. Draft preserved so you can adjust before trying again.",
    );
  };

  const fetchAndUpdateMetrics = async (campaignId: string) => {
    let shouldFinalize = false;
    let finalizeOutcome: "completed" | "cancelled" | null = null;
    try {
      const summary = await apiClient.request<{
        campaign: { status: string };
        metrics: { totalRecipients: number; sentCount: number; opens: number; clicks: number };
      }>(`/api/campaigns/${campaignId}`);

      setLaunchMonitor((prev) => {
        if (!prev.open || prev.campaignId !== campaignId) {
          return prev;
        }
        const { metrics, campaign } = summary;
        const ratio =
          metrics.totalRecipients > 0 ? metrics.sentCount / metrics.totalRecipients : 0;
        const dynamicPercent = metrics.totalRecipients
          ? Math.min(95, 60 + Math.round(ratio * 35))
          : prev.percent;
        let nextStatus = prev.status;
        let nextPhase = prev.phase;
        let nextPercent = Math.max(prev.percent, dynamicPercent);

        if (campaign.status === "CANCELLED") {
          nextStatus = "cancelled";
          nextPhase = "cancelled";
          nextPercent = 100;
          shouldFinalize = true;
          finalizeOutcome = "cancelled";
        } else if (campaign.status === "PAUSED") {
          nextStatus = "paused";
          nextPhase = "paused";
        } else if (metrics.totalRecipients > 0 && metrics.sentCount >= metrics.totalRecipients) {
          nextStatus = "completed";
          nextPhase = "completed";
          nextPercent = 100;
          shouldFinalize = true;
          finalizeOutcome = "completed";
        }

        return {
          ...prev,
          status: nextStatus,
          phase: nextPhase,
          percent: nextPercent,
          metrics: {
            totalRecipients: metrics.totalRecipients,
            sentCount: metrics.sentCount,
            opens: metrics.opens,
            clicks: metrics.clicks,
            statusLabel: campaign.status,
          },
          finalized: prev.finalized || shouldFinalize,
        };
      });

      if (shouldFinalize && finalizeOutcome) {
        clearMonitorInterval();
        appendLaunchLog(
          finalizeOutcome === "completed"
            ? "All recipients processed."
            : "Campaign delivery halted.",
        );
        await finalizeAfterLaunch(finalizeOutcome);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch delivery status.";
      appendLaunchLog(`Status check failed: ${message}`);
    }
  };

  const startMonitoring = (campaignId: string) => {
    clearMonitorInterval();
    setLaunchMonitor((prev) => ({
      ...prev,
      campaignId,
      phase: "monitoring",
      status: "running",
      percent: Math.max(prev.percent, 60),
    }));
    appendLaunchLog("Monitoring delivery progress…");
    void fetchAndUpdateMetrics(campaignId);
    monitorIntervalRef.current = window.setInterval(() => {
      void fetchAndUpdateMetrics(campaignId);
    }, 5000);
  };

  const handleLaunchCampaign = async () => {
    if (
      !importResult ||
      createCampaignMutation.isPending ||
      (launchMonitor.open &&
        (launchMonitor.status === "running" || launchMonitor.status === "paused"))
    ) {
      return;
    }
    launchFinalizedRef.current = false;
    clearMonitorInterval();
    setLaunchMonitor({
      ...createInitialLaunchMonitor(),
      open: true,
      status: "running",
      phase: "creating",
      percent: 10,
    });
    appendLaunchLog("Creating campaign…");

    let campaignId: string;
    try {
      campaignId = await createCampaignMutation.mutateAsync();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create the campaign. Try again.";
      setLaunchMonitor((prev) => ({
        ...prev,
        status: "error",
        phase: "error",
        percent: Math.max(prev.percent, 15),
        error: message,
      }));
      appendLaunchLog(`Error: ${message}`);
      return;
    }

    setLaunchMonitor((prev) => ({
      ...prev,
      campaignId,
      phase: "scheduling",
      percent: Math.max(prev.percent, 30),
    }));
    appendLaunchLog("Campaign created. Scheduling delivery…");

    try {
      await apiClient.request(`/api/campaigns/${campaignId}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          startAt,
        }),
      });
      appendLaunchLog("Launch schedule confirmed.");
      setLaunchMonitor((prev) => ({
        ...prev,
        percent: Math.max(prev.percent, 45),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to schedule the campaign.";
      setLaunchMonitor((prev) => ({
        ...prev,
        status: "error",
        phase: "error",
        percent: Math.max(prev.percent, 45),
        error: message,
      }));
      appendLaunchLog(`Error: ${message}`);
      return;
    }

    if (followUpSequence && followUpSequence.steps.length > 0) {
      appendLaunchLog("Saving follow-up sequence…");
      setLaunchMonitor((prev) => ({
        ...prev,
        phase: "followUps",
        percent: Math.max(prev.percent, 55),
      }));
      try {
        await apiClient.request("/api/follow-ups", {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            ...followUpSequence,
          }),
        });
        appendLaunchLog("Follow-up sequence attached.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save follow-up sequence.";
        setLaunchMonitor((prev) => ({
          ...prev,
          status: "error",
          phase: "error",
          error: message,
        }));
        appendLaunchLog(`Error: ${message}`);
        return;
      }
    }

    startMonitoring(campaignId);
  };

  const handlePauseCampaign = async () => {
    if (!launchMonitor.campaignId) {
      return;
    }
    try {
      await apiClient.request(`/api/campaigns/${launchMonitor.campaignId}/pause`, {
        method: "POST",
      });
      clearMonitorInterval();
      appendLaunchLog("Campaign paused.");
      setLaunchMonitor((prev) => ({
        ...prev,
        status: "paused",
        phase: "paused",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to pause campaign.";
      appendLaunchLog(`Pause failed: ${message}`);
      setLaunchMonitor((prev) => ({
        ...prev,
        error: message,
      }));
    }
  };

  const handleCancelCampaign = async () => {
    if (!launchMonitor.campaignId) {
      return;
    }
    try {
      await apiClient.request(`/api/campaigns/${launchMonitor.campaignId}/cancel`, {
        method: "POST",
      });
      clearMonitorInterval();
      appendLaunchLog("Campaign cancelled.");
      setLaunchMonitor((prev) => ({
        ...prev,
        status: "cancelled",
        phase: "cancelled",
        percent: 100,
        finalized: true,
      }));
      await finalizeAfterLaunch("cancelled");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel campaign.";
      appendLaunchLog(`Cancel failed: ${message}`);
      setLaunchMonitor((prev) => ({
        ...prev,
        error: message,
      }));
    }
  };

  const handleCloseLaunchMonitor = () => {
    // Allow closing even when campaign is running - campaign continues in background
    // Stop monitoring interval to avoid unnecessary API calls, but campaign keeps running on backend
    clearMonitorInterval();
    // Just close the modal - don't reset everything so campaign can continue
    setLaunchMonitor((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const launchInFlight = launchMonitor.open && launchMonitor.status === "running";
  const canPauseLaunch = Boolean(
    launchMonitor.campaignId && launchMonitor.status === "running" && launchMonitor.phase !== "creating",
  );
  const canStopLaunch = Boolean(
    launchMonitor.campaignId &&
      (launchMonitor.status === "running" || launchMonitor.status === "paused") &&
      launchMonitor.phase !== "creating",
  );
  const launchLocked =
    launchMonitor.open && (launchMonitor.status === "running" || launchMonitor.status === "paused");
  // Allow closing the modal at any time - campaign continues in background
  const canCloseLaunchMonitor = true;

  const recipientsCount = importResult?.records.length ?? 0;
  const mergeFields = useMemo(() => {
    if (!importResult) return [];
    const unique = new Set(
      importResult.headers
        .map((header) => header.trim())
        .filter((header) => header.length > 0),
    );
    return Array.from(unique);
  }, [importResult]);

  const [previewIndex, setPreviewIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredRecipients = useMemo(() => {
    if (!importResult || !searchQuery.trim()) return importResult?.records ?? [];
    const lowercaseQuery = searchQuery.toLowerCase();
    return (importResult?.records ?? []).filter((record) =>
      Object.values(record).some((value) =>
        (value ?? "").toLowerCase().includes(lowercaseQuery),
      ),
    );
  }, [importResult, searchQuery]);
  const safePreviewIndex = Math.min(
    Math.max(0, previewIndex),
    Math.max((filteredRecipients.length ?? 1) - 1, 0),
  );
  const sampleRecipient = useMemo(() => {
    if (!importResult || filteredRecipients.length === 0) return null;
    return filteredRecipients[safePreviewIndex] ?? null;
  }, [importResult, filteredRecipients, safePreviewIndex]);
  useEffect(() => {
    if (!importResult) {
      setPreviewIndex(0);
      setSearchQuery("");
      setIsSearchOpen(false);
      return;
    }
    if (filteredRecipients.length === 0) {
      setPreviewIndex(0);
      return;
    }
    if (safePreviewIndex !== previewIndex) {
      setPreviewIndex(safePreviewIndex);
    }
  }, [importResult, filteredRecipients, previewIndex, safePreviewIndex]);
  const normalizedSample = useMemo(
    () => (sampleRecipient ? normalizeRecord(sampleRecipient) : null),
    [sampleRecipient],
  );
  const subjectPreview = useMemo(() => {
    if (!normalizedSample) return subjectTemplate;
    return renderTemplate(subjectTemplate, normalizedSample);
  }, [subjectTemplate, normalizedSample]);
  const bodyPreview = useMemo(() => {
    if (!normalizedSample) return bodyTemplate;
    return renderTemplate(bodyTemplate, normalizedSample);
  }, [bodyTemplate, normalizedSample]);
  const subjectTokens = useMemo(() => findMergeFields(subjectTemplate), [subjectTemplate]);
  const bodyTokens = useMemo(() => findMergeFields(bodyTemplate), [bodyTemplate]);
  const missingTokens = useMemo(() => {
    if (!importResult || mergeFields.length === 0) return [];
    const allTokens = [...subjectTokens, ...bodyTokens];
    const lowerFields = new Set(mergeFields.map((field) => field.toLowerCase()));
    const missingSet = new Set<string>();
    for (const token of allTokens) {
      if (!lowerFields.has(token.toLowerCase())) {
        missingSet.add(token);
      }
    }
    return Array.from(missingSet);
  }, [importResult, mergeFields, subjectTokens, bodyTokens]);
  const unusedColumns = useMemo(() => {
    if (!importResult || mergeFields.length === 0) return [];
    const lowerTokens = new Set(
      [...subjectTokens, ...bodyTokens].map((token) => token.toLowerCase()),
    );
    return mergeFields.filter((field) => !lowerTokens.has(field.toLowerCase()));
  }, [importResult, mergeFields, subjectTokens, bodyTokens]);

  const startAtError =
    new Date(startAt).getTime() - Date.now() < 60_000
      ? "Start time should be at least 1 minute in the future."
      : null;

  const plainBody = bodyTemplate.replace(/<[^>]+>/g, "").trim();

  const validationMessages: string[] = [];
  if (!importResult) validationMessages.push("Import recipients from Google Sheets.");
  if (!campaignName.trim()) validationMessages.push("Provide a campaign name.");
  if (!subjectTemplate.trim()) validationMessages.push("Subject template cannot be empty.");
  if (!plainBody) validationMessages.push("Email body cannot be empty.");
  if (startAtError) validationMessages.push(startAtError);
  if (missingTokens.length > 0) {
    validationMessages.push(
      `Fix ${missingTokens.length} merge field${
        missingTokens.length === 1 ? "" : "s"
      } that are not in your sheet.`,
    );
  }

  const isLaunchDisabled =
    validationMessages.length > 0 ||
    createCampaignMutation.isPending ||
    !importResult ||
    launchLocked;

  const handleStartAtChange = (value: string) => {
    if (!value) {
      updateComposerDraft({ startAt: initialStartAt() });
      return;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      updateComposerDraft({ startAt: parsed.toISOString() });
    }
  };

  const closeSubjectAutocomplete = () => {
    setSubjectAutocompleteState((state) => ({ ...state, open: false }));
  };

  const insertTokenIntoSubject = (token: string) => {
    if (!token) return;
    const trimmed = subjectTemplate.trimEnd();
    const spacer = trimmed.length > 0 && !trimmed.endsWith(" ") ? " " : "";
    const next = `${trimmed}${spacer}{{${token}}}`;
    updateComposerDraft({ subjectTemplate: next });
    closeSubjectAutocomplete();
  };

  useEffect(() => {
    if (!autocompleteEnabled || mergeFields.length === 0) {
      setSubjectAutocompleteState((state) => ({ ...state, open: false }));
    }
  }, [autocompleteEnabled, mergeFields.length]);

  const updateSubjectAutocomplete = () => {
    const input = subjectInputRef.current;
    if (!input || !autocompleteEnabled || mergeFields.length === 0) {
      closeSubjectAutocomplete();
      return;
    }

    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const match = prefix.match(/{{([\w.-]*)$/);

    if (!match) {
      closeSubjectAutocomplete();
      return;
    }

    const token = match[1] ?? "";
    const filtered =
      token.length === 0
        ? mergeFields
        : mergeFields.filter((field) => field.toLowerCase().includes(token.toLowerCase()));

    const anchorRect = input.getBoundingClientRect();

    setSubjectAutocompleteState({
      open: true,
      anchorRect,
      filtered,
      selectedIndex: 0,
      tokenStart: caret - token.length - 2,
      caretIndex: caret,
    });
  };

  const applySubjectSuggestion = (field: string) => {
    const input = subjectInputRef.current;
    if (!input) {
      closeSubjectAutocomplete();
      return;
    }

    const value = input.value;
    const { tokenStart, caretIndex } = subjectAutocompleteState;
    const before = value.slice(0, tokenStart);
    const after = value.slice(caretIndex);
    const insertion = `{{${field}}}`;
    const nextValue = `${before}${insertion}${after}`;

    updateComposerDraft({ subjectTemplate: nextValue });
    closeSubjectAutocomplete();

    requestAnimationFrame(() => {
      const nextCursor = before.length + insertion.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateComposerDraft({ subjectTemplate: event.target.value });
    requestAnimationFrame(updateSubjectAutocomplete);
  };

  const handleSubjectKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!autocompleteEnabled) {
      if (event.key === "Escape") {
        closeSubjectAutocomplete();
      }
      return;
    }

    if (!subjectAutocompleteState.open) {
      if (event.key === "{" || event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
        requestAnimationFrame(updateSubjectAutocomplete);
      }
      if (event.key === "Escape") {
        closeSubjectAutocomplete();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setSubjectAutocompleteState((state) => {
          if (state.filtered.length === 0) return state;
          const nextIndex = (state.selectedIndex + 1) % state.filtered.length;
          return { ...state, selectedIndex: nextIndex };
        });
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setSubjectAutocompleteState((state) => {
          if (state.filtered.length === 0) return state;
          const nextIndex =
            (state.selectedIndex - 1 + state.filtered.length) % state.filtered.length;
          return { ...state, selectedIndex: nextIndex };
        });
        break;
      }
      case "Enter":
      case "Tab": {
        if (subjectAutocompleteState.filtered.length > 0) {
          event.preventDefault();
          const choice =
            subjectAutocompleteState.filtered[subjectAutocompleteState.selectedIndex] ??
            subjectAutocompleteState.filtered[0];
          applySubjectSuggestion(choice);
        } else {
          closeSubjectAutocomplete();
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        closeSubjectAutocomplete();
        break;
      }
      default: {
        requestAnimationFrame(updateSubjectAutocomplete);
        break;
      }
    }
  };

  const handleSubjectFocus = () => {
    if (autocompleteEnabled) {
      requestAnimationFrame(updateSubjectAutocomplete);
    }
  };

  const handleSubjectSuggestionHover = (index: number) => {
    setSubjectAutocompleteState((state) => ({ ...state, selectedIndex: index }));
  };

  const handleSaveDraft = () => {
    const now = new Date();
    updateComposerDraft({ lastSavedAt: now.toISOString() });
    setSaveMessage("Draft saved");

    if (saveMessageTimeoutRef.current) {
      window.clearTimeout(saveMessageTimeoutRef.current);
    }
    saveMessageTimeoutRef.current = window.setTimeout(() => {
      setSaveMessage(null);
    }, 4000);
  };

  const handleTogglePreview = () => {
    setShowPreview((prev) => !prev);
  };

  const appendHtmlBlock = (html: string, block: string) => {
    if (!html || html.trim().length === 0) {
      return block;
    }
    return `${html}${block}`;
  };

  const handleInsertMeetingLinkIntoBody = (link: string, meetingName: string, linkLabel: string) => {
    if (!link) return;
    if (bodyTemplate.includes(link)) {
      return;
    }
    const anchor = `<p><strong>${linkLabel || "Schedule time"}:</strong> <a href="${link}" target="_blank" rel="noopener">${meetingName} - pick a time that works for you</a></p>`;
    const nextHtml = appendHtmlBlock(bodyTemplate, anchor);
    updateComposerDraft({ bodyTemplate: nextHtml });
  };

  const handleInsertMeetingCalloutIntoSubject = (cta: string) => {
    if (!cta) return;
    if (subjectTemplate.includes(cta)) {
      return;
    }
    const divider = subjectTemplate.trim().length > 0 ? " • " : "";
    updateComposerDraft({ subjectTemplate: `${subjectTemplate}${divider}${cta}` });
  };

  const delaySeconds = Math.max(5, Math.round(delayMsBetweenEmails / 1000));
  const setDelaySeconds = (seconds: number) => {
    updateComposerDraft({ delayMsBetweenEmails: Math.max(5, seconds) * 1000 });
  };

  const recipientsLabel = importResult
    ? `${recipientsCount} recipient${recipientsCount === 1 ? "" : "s"} ready`
    : "No recipients imported yet";
  const startAtLabel = `Starts ${new Date(startAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  const delayLabel = `Delay ${delaySeconds} sec between emails`;
  const followUpSummary = followUpSequence
    ? `${followUpSequence.steps.length} follow-up step${followUpSequence.steps.length === 1 ? "" : "s"}`
    : "No follow-ups";

  const steps: StepConfig[] = [
    {
      id: "audience",
      title: "Audience",
      description: "Import recipients and identify your email column.",
    },
    {
      id: "email",
      title: "Email",
      description: "Craft the subject and personalize your message.",
    },
    {
      id: "schedule",
      title: "Schedule",
      description: "Choose when to send and enable tracking.",
    },
    {
      id: "review",
      title: "Review",
      description: "Check everything before launch.",
    },
  ];

  const stepBlockingMessages: Record<StepId, string[]> = {
    audience: [],
    email: [],
    schedule: [],
    review: [...validationMessages],
  };

  if (!importResult) stepBlockingMessages.audience.push("Import recipients from Google Sheets.");
  if (!emailField) stepBlockingMessages.audience.push("Select the column that contains recipient email addresses.");

  if (!subjectTemplate.trim()) stepBlockingMessages.email.push("Subject template cannot be empty.");
  if (!plainBody) stepBlockingMessages.email.push("Email body cannot be empty.");

  if (startAtError) stepBlockingMessages.schedule.push(startAtError);

  const currentStep = steps[currentStepIndex];
  const currentBlockingMessages = stepBlockingMessages[currentStep.id];
  const canProceed = currentBlockingMessages.length === 0;
  const isFinalStep = currentStep.id === "review";

  const isStepComplete = (stepId: StepId) => stepBlockingMessages[stepId].length === 0;
  const canAccessStep = (index: number) =>
    index <= currentStepIndex || steps.slice(0, index).every((step) => isStepComplete(step.id));

  const handleStepClick = (index: number) => {
    if (canAccessStep(index)) {
      setCurrentStepIndex(index);
    }
  };

  const handleBack = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (isFinalStep) {
      if (isLaunchDisabled) {
        return;
      }
      void handleLaunchCampaign();
      return;
    }
    if (!canProceed) return;
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const nextButtonLabel =
    isFinalStep && !launchInFlight
      ? "Launch campaign"
      : isFinalStep
        ? "Launching..."
        : "Next step";
  const nextButtonDisabled = isFinalStep ? isLaunchDisabled : !canProceed;

  const renderAudienceStep = () => (
    <>
      <Section title="Campaign details">
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Campaign name</span>
          <input
            type="text"
            value={campaignName}
            onChange={(event) => updateComposerDraft({ campaignName: event.target.value })}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #dadce0",
              fontSize: "14px",
              color: "#202124",
              backgroundColor: "#fff",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#1a73e8";
              e.currentTarget.style.outline = "none";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#dadce0";
            }}
            placeholder="Fall Outreach Sequence"
          />
        </label>
      </Section>

      <Section
        title="Recipients"
        description="Import a Google Sheet, choose the email column, and review the first few rows."
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Google Sheet URL</span>
            <input
              type="url"
              value={sheetUrl}
              onChange={(event) => updateComposerDraft({ sheetUrl: event.target.value })}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </label>
          <label style={{ width: "120px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Header row</span>
            <input
              type="number"
              min={0}
              value={headerRowIndex}
              onChange={(event) => updateComposerDraft({ headerRowIndex: Number(event.target.value) })}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
            />
          </label>
          <Button
            style={{ minWidth: "160px" }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              importMutation.mutate();
            }}
            disabled={!sheetUrl || importMutation.isPending}
          >
            {importMutation.isPending ? "Importing..." : "Import sheet"}
          </Button>
        </div>

        {importResult ? (
          <>
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "#f8f9fa",
                border: "1px solid #e0e3e7",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <strong>{importResult.sheetSource.title}</strong>
              <span style={{ fontSize: "13px", color: "#5f6368" }}>
                {recipientsCount} rows imported • Columns: {importResult.headers.join(", ")}
              </span>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Email column</span>
                <select
                  value={emailField}
                  onChange={(event) => updateComposerDraft({ emailField: event.target.value })}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #dadce0",
                    fontSize: "14px",
                    color: "#202124",
                    backgroundColor: "#fff",
                    transition: "border-color 0.2s ease",
                    cursor: "pointer",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1a73e8";
                    e.currentTarget.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#dadce0";
                  }}
                >
                  {importResult.headers.map((header) => (
                    <option key={header} value={header}>
                      {header || "(unnamed column)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #e0e3e7" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead style={{ backgroundColor: "#f1f3f4" }}>
                  <tr>
                    {importResult.headers.map((header) => (
                      <th
                        key={header}
                        style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e0e3e7" }}
                      >
                        {header || "(unnamed column)"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importResult.records.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      {importResult.headers.map((header) => (
                        <td
                          key={header}
                          style={{
                            padding: "8px",
                            borderBottom: "1px solid #f1f3f4",
                            color: "#3c4043",
                          }}
                        >
                          {row[header] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {recipientsCount > 5 ? (
                <div style={{ padding: "8px 12px", fontSize: "12px", color: "#5f6368" }}>
                  Showing first 5 of {recipientsCount} rows.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <span style={{ fontSize: "13px", color: "#5f6368" }}>
            Import a Google Sheet share link to hydrate your recipient list.
          </span>
        )}
      </Section>
    </>
  );

  const renderEmailStep = () => (
    <>
      <Section
        title="Email content"
        description="Craft your subject and body using merge fields. Use the preview to verify personalization."
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Subject line</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={subjectInputRef}
              type="text"
              value={subjectTemplate}
              onChange={handleSubjectChange}
              onKeyDown={handleSubjectKeyDown}
              onFocus={(e) => {
                handleSubjectFocus();
                e.currentTarget.style.borderColor = "#1a73e8";
                e.currentTarget.style.outline = "none";
              }}
              onBlur={(e) => {
                window.setTimeout(() => {
                  closeSubjectAutocomplete();
                }, 120);
                e.currentTarget.style.borderColor = "#dadce0";
              }}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
                fontSize: "14px",
                color: "#202124",
                backgroundColor: "#fff",
                transition: "border-color 0.2s ease",
              }}
            />
            <select
              defaultValue=""
              onChange={(event) => {
                insertTokenIntoSubject(event.target.value);
                event.currentTarget.selectedIndex = 0;
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
            >
              <option value="">Insert merge field</option>
              {mergeFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              onClick={() =>
                updateComposerDraft({ autocompleteEnabled: !autocompleteEnabled })
              }
              aria-pressed={autocompleteEnabled}
              style={{
                padding: "0 12px",
                height: "40px",
                minWidth: "fit-content",
              }}
            >
              {autocompleteEnabled ? "Autocomplete on" : "Autocomplete off"}
            </Button>
            {missingTokens.length > 0 ? (
              <span style={{ fontSize: "12px", color: "#c5221f" }}>
                {missingTokens.length} unresolved merge field
                {missingTokens.length === 1 ? "" : "s"}.
              </span>
            ) : null}
          </div>
        </label>
        <MergeFieldAutocomplete
          anchorRect={subjectAutocompleteState.anchorRect}
          suggestions={subjectAutocompleteState.filtered}
          highlightedIndex={subjectAutocompleteState.selectedIndex}
          visible={subjectAutocompleteState.open && autocompleteEnabled}
          onSelect={applySubjectSuggestion}
          onHover={handleSubjectSuggestionHover}
        />

        <MeetingTypePicker
          backendUrl={backendUrl ?? ""}
          onInsertIntoBody={handleInsertMeetingLinkIntoBody}
          onInsertIntoSubject={handleInsertMeetingCalloutIntoSubject}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Body</span>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#5f6368" }}>
              Craft rich layouts with headings, fonts, colors, lists, and merge fields.
            </p>
          </div>
          <RichTextEditor
            ref={richTextEditorRef}
            value={bodyTemplate}
            onChange={(html) => updateComposerDraft({ bodyTemplate: html })}
            mergeFields={mergeFields}
            autocompleteEnabled={autocompleteEnabled}
            placeholder="Write your opening, add personalization, and include call-to-actions."
          />
        </div>
      </Section>
    </>
  );

  const renderValidationInsights = () => {
    if (!importResult) return null;

    return (
      <Section title="Merge field insights" description="Make sure every token lines up with your sheet.">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {missingTokens.length === 0 ? (
            <span style={{ fontSize: "13px", color: "#137333" }}>All merge fields match your sheet.</span>
          ) : (
            <div
              style={{
                border: "1px solid #f6aea9",
                borderRadius: "10px",
                padding: "12px",
                backgroundColor: "#fce8e6",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <strong style={{ fontSize: "13px", color: "#c5221f" }}>
                {missingTokens.length} unresolved merge field{missingTokens.length === 1 ? "" : "s"}
              </strong>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#5f6368" }}>
                {missingTokens.map((token) => (
                  <li key={`missing-${token}`}>{token}</li>
                ))}
              </ul>
              <span style={{ fontSize: "12px", color: "#5f6368" }}>
                Fix spelling or add these headers to your sheet so personalization works.
              </span>
            </div>
          )}

          {unusedColumns.length > 0 ? (
            <div
              style={{
                border: "1px solid #d2e3fc",
                borderRadius: "10px",
                padding: "12px",
                backgroundColor: "#e8f0fe",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <strong style={{ fontSize: "13px", color: "#1a73e8" }}>
                {unusedColumns.length} column{unusedColumns.length === 1 ? "" : "s"} unused in your templates
              </strong>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#5f6368" }}>
                {unusedColumns.map((column) => (
                  <li key={`unused-${column}`}>{column}</li>
                ))}
              </ul>
              <span style={{ fontSize: "12px", color: "#5f6368" }}>
                Consider trimming unused columns to keep imports tidy.
              </span>
            </div>
          ) : null}
        </div>
      </Section>
    );
  };

  const renderScheduleStep = () => (
    <>
      <Section
        title="Scheduling"
        description="Control when the campaign starts and how messages are paced."
      >
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Start time</span>
            <input
              type="datetime-local"
              value={toLocalDateTimeInput(startAt)}
              onChange={(event) => handleStartAtChange(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
            />
            <span style={{ fontSize: "12px", color: "#5f6368" }}>
              Local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </label>

          <label style={{ width: "180px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Delay between emails</span>
            <input
              type="number"
              min={5}
              value={delaySeconds}
              onChange={(event) => setDelaySeconds(Number(event.target.value))}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
            />
            <span style={{ fontSize: "12px", color: "#5f6368" }}>Seconds between sends (minimum 5)</span>
          </label>
        </div>
      </Section>

      <Section title="Tracking">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <input
              type="checkbox"
              checked={trackOpens}
              onChange={(event) => updateComposerDraft({ trackOpens: event.target.checked })}
            />
            Track opens with a pixel
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <input
              type="checkbox"
              checked={trackClicks}
              onChange={(event) => updateComposerDraft({ trackClicks: event.target.checked })}
            />
            Track link clicks with redirects
          </label>
        </div>
      </Section>
    </>
  );

  const renderReviewStep = () => (
    <>
      <Section
        title="Summary"
        description="One last sanity check before you go live."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <SummaryRow label="Campaign" value={campaignName || "Untitled campaign"} />
          <SummaryRow label="Recipients" value={recipientsLabel} />
          <SummaryRow label="Start time" value={startAtLabel} />
          <SummaryRow label="Cadence" value={`Delay of ${delaySeconds} seconds between emails`} />
          <SummaryRow
            label="Tracking"
            value={`Opens ${trackOpens ? "on" : "off"} • Clicks ${trackClicks ? "on" : "off"}`}
          />
          <SummaryRow label="Follow-ups" value={followUpSummary} />
        </div>
      </Section>

      <Section
        title="Follow-ups (optional)"
        description="Plan nudges after the initial outreach and keep conversations moving."
      >
        <p style={{ fontSize: "13px", color: "#5f6368", margin: 0 }}>
          Follow-ups send automatically when recipients don’t respond. Configure personalized sequences with
          delays, branching, and inbox labels.
        </p>
        {followUpSequence ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              border: "1px solid #e0e3e7",
              borderRadius: "10px",
              padding: "10px",
              backgroundColor: "#f8f9fa",
            }}
          >
            <strong style={{ fontSize: "13px" }}>{followUpSequence.name}</strong>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#3c4043" }}>
              {followUpSequence.steps.map((step, index) => {
                let timingText = "";
                if (step.useDateTime && step.scheduledAt) {
                  // Show specific date/time
                  const date = new Date(step.scheduledAt);
                  const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  timingText = `${dateStr} at ${timeStr}`;
                } else if (step.delayMs) {
                  // Show relative delay
                  const hours = Math.round(step.delayMs / 3600000);
                  const days = Math.round(step.delayMs / (24 * 3600000));
                  if (days >= 1) {
                    timingText = `${days} day${days !== 1 ? "s" : ""} later`;
                  } else {
                    timingText = `${hours}h later`;
                  }
                } else {
                  timingText = "No delay set";
                }
                return (
                  <li key={`follow-up-step-${index}`}>
                    {timingText} — {step.subject}
                    {step.sendAsReply && <span style={{ color: "#1a73e8", fontSize: "11px" }}> (as reply)</span>}
                    {step.isNested && <span style={{ color: "#5f6368", fontSize: "11px" }}> (nested)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "#5f6368" }}>
            No follow-up sequence yet. Add one to automatically nudge non-responders.
          </span>
        )}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openFollowUpOverlay(followUpSequence);
            }}
          >
            {followUpSequence ? "Edit follow-ups" : "Plan follow-ups"}
          </Button>
          <span style={{ fontSize: "12px", color: "#5f6368", alignSelf: "center" }}>
            You can always add them later—campaign launch only needs the first email.
          </span>
        </div>
      </Section>

      {renderValidationInsights()}

      {validationMessages.length > 0 && (
        <div
          style={{
            border: "1px solid #f6c3c3",
            borderRadius: "10px",
            backgroundColor: "#fef3f2",
            padding: "12px",
            fontSize: "13px",
            color: "#b3261e",
          }}
        >
          <strong style={{ display: "block", marginBottom: "6px" }}>Fix before launching:</strong>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {(importMutation.error || createCampaignMutation.error) && (
        <div
          style={{
            border: "1px solid #f6c3c3",
            borderRadius: "10px",
            backgroundColor: "#fef3f2",
            padding: "12px",
            fontSize: "13px",
            color: "#b3261e",
          }}
        >
          {(importMutation.error as Error | undefined)?.message ??
            (createCampaignMutation.error as Error | undefined)?.message ??
            "Something went wrong while saving your campaign."}
        </div>
      )}
    </>
  );

  const stepContent = (() => {
    switch (currentStep.id) {
      case "audience":
        return renderAudienceStep();
      case "email":
        return renderEmailStep();
      case "schedule":
        return renderScheduleStep();
      case "review":
      default:
        return renderReviewStep();
    }
  })();

  const shouldShowBlockingBanner = currentBlockingMessages.length > 0 && currentStep.id !== "review";

  const goToNextPreview = () => {
    if (!filteredRecipients || filteredRecipients.length === 0) return;
    setPreviewIndex((current) => (current + 1) % filteredRecipients.length);
  };

  const goToPreviousPreview = () => {
    if (!filteredRecipients || filteredRecipients.length === 0) return;
    setPreviewIndex((current) => (current - 1 + filteredRecipients.length) % filteredRecipients.length);
  };

  const toggleSearchPanel = () => {
    setIsSearchOpen((prev) => !prev);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setPreviewIndex(0);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPreviewIndex(0);
  };

  return (
    <>
      <FloatingPreviewCard
        show={showPreview}
        onClose={() => setShowPreview(false)}
        campaignName={campaignName || "Untitled campaign"}
        recipientsLabel={recipientsLabel}
        startAtLabel={startAtLabel}
        delayLabel={delayLabel}
        subjectPreview={subjectPreview}
        bodyPreview={bodyPreview}
        mergeFieldStatus={{
          missing: missingTokens,
          unused: unusedColumns,
        }}
        recipientNavigator={
          importResult && filteredRecipients.length > 0
            ? {
                currentIndex: safePreviewIndex,
                total: filteredRecipients.length,
                onPrevious: goToPreviousPreview,
                onNext: goToNextPreview,
              }
            : undefined
        }
        searchControls={
          importResult
            ? {
                isOpen: isSearchOpen,
                query: searchQuery,
                onChange: handleSearchChange,
                onToggle: toggleSearchPanel,
                onClear: clearSearch,
                hasResults: filteredRecipients.length > 0,
                totalResults: filteredRecipients.length,
              }
            : undefined
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            padding: "12px 20px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <StatusChip label="Draft" tone="info" />
            <StatusChip label={recipientsLabel} tone={importResult ? "success" : "warning"} />
            <StatusChip label={startAtLabel} tone="info" />
            <StatusChip label={followUpSummary} tone={followUpSequence ? "success" : "info"} />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const openWindow = (window as any).__taskforceOpenWindow;
                if (openWindow) {
                  openWindow("taskforce-floating-best-practices");
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <span>ℹ️</span>
              <span>Best Practices</span>
            </Button>
            <Button
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTogglePreview();
              }}
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </Button>
            <Button
              variant="secondary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSaveDraft();
              }}
            >
              Save draft
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLaunchDisabled) {
                  void handleLaunchCampaign();
                }
              }}
              disabled={isLaunchDisabled}
            >
              {launchInFlight ? "Launching..." : "Launch"}
            </Button>
          </div>
        </div>

        {saveMessage ? (
          <div style={{ fontSize: "12px", color: saveMessage.includes("Failed") ? "#b3261e" : "#137333" }}>
            {saveMessage}
            {savedAtDate && !saveMessage.includes("Failed")
              ? ` • ${savedAtDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </div>
        ) : null}

        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <StepIndicator
              steps={steps}
              currentIndex={currentStepIndex}
              isStepComplete={isStepComplete}
              canAccessStep={canAccessStep}
              onStepClick={handleStepClick}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <header>
                <h2 style={{ margin: 0, fontSize: "20px" }}>{currentStep.title}</h2>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#5f6368" }}>{currentStep.description}</p>
              </header>

              {stepContent}

              {shouldShowBlockingBanner ? (
                <div
                  style={{
                    border: "1px solid #f6c3c3",
                    borderRadius: "10px",
                    backgroundColor: "#fef3f2",
                    padding: "12px",
                    fontSize: "13px",
                    color: "#b3261e",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "6px" }}>Complete this step to continue:</strong>
                  <ul style={{ margin: 0, paddingLeft: "18px" }}>
                    {currentBlockingMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Button
                variant="secondary"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBack(e);
                }}
                disabled={currentStepIndex === 0}
              >
                Back
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNext(e);
                }}
                disabled={nextButtonDisabled}
              >
                {nextButtonLabel}
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <FollowUpOverlay />
      <CampaignLaunchProgress
        open={launchMonitor.open}
        status={launchMonitor.status}
        phase={launchMonitor.phase}
        percent={launchMonitor.percent}
        metrics={launchMonitor.metrics}
        logs={launchMonitor.logs}
        error={launchMonitor.error}
        canPause={canPauseLaunch}
        canStop={canStopLaunch}
        canClose={canCloseLaunchMonitor}
        onPause={canPauseLaunch ? handlePauseCampaign : undefined}
        onStop={canStopLaunch ? handleCancelCampaign : undefined}
        onClose={handleCloseLaunchMonitor}
      />
    </>
  );
};



