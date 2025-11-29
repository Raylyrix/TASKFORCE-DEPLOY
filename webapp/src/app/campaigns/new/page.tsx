"use client";

/**
 * Single-Page Campaign Composer
 * 
 * A comprehensive campaign creation interface with all features accessible on one page:
 * - Google Sheets import
 * - Rich text email editor with merge field autocomplete
 * - Follow-up sequence builder
 * - Real-time preview
 * - Campaign scheduling and tracking
 * - Draft auto-save
 * - Campaign launch progress monitor
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatISO, addMinutes } from "date-fns";
import {
  Mail,
  Upload,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  Plus,
  X,
  Info,
  Send,
  Settings,
  FileText,
  ArrowRight,
  Save,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  RefreshCw,
  Zap,
  Paperclip,
} from "lucide-react";
import { EmailBestPracticesModal } from "@/components/EmailBestPracticesModal";
import { CampaignLaunchProgress } from "@/components/CampaignLaunchProgress";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { MergeFieldAutocomplete } from "@/components/MergeFieldAutocomplete";
import { FollowUpSequenceBuilder } from "@/components/FollowUpSequenceBuilder";

const MERGE_FIELD_REGEX = /{{\s*([^}]+)\s*}}/g;

type FollowUpStep = {
  id: string;
  subject: string;
  html: string;
  delayMs?: number;
  scheduledAt?: string;
  sendAsReply: boolean;
  useDateTime: boolean;
  parentStepId?: string;
  isNested: boolean;
};

type FollowUpSequence = {
  name: string;
  steps: FollowUpStep[];
};

type Attachment = {
  filename: string;
  content: string; // Base64-encoded file content
  contentType?: string;
  size?: number;
};

export default function NewCampaignPage() {
  const router = useRouter();
  
  // Core campaign state
  const [campaignName, setCampaignName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [emailField, setEmailField] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [startAt, setStartAt] = useState(formatISO(addMinutes(new Date(), 5)).slice(0, 16));
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // UI state
  const [showPreview, setShowPreview] = useState(true);
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [showLaunchProgress, setShowLaunchProgress] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [showFollowUpBuilder, setShowFollowUpBuilder] = useState(false);
  const [showMergeFields, setShowMergeFields] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // Follow-up state
  const [followUpSequence, setFollowUpSequence] = useState<FollowUpSequence | null>(null);
  
  // Preview state
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Subject autocomplete state
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
  
  // Launch state
  const [launchedCampaignId, setLaunchedCampaignId] = useState<string | null>(null);
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(true);
  
  const subjectInputRef = useRef<HTMLInputElement | null>(null);
  const richTextEditorRef = useRef<RichTextEditorHandle | null>(null);
  const saveMessageTimeoutRef = useRef<number | null>(null);

  const { data: meetingTypes } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  // Merge fields from imported sheet
  const mergeFields = useMemo(() => {
    if (!importResult) return [] as string[];
    const columns = importResult.columns || importResult.headers || [];
    return Array.from(new Set(columns.map((col: string) => String(col).trim()).filter(Boolean))) as string[];
  }, [importResult]);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = {
        campaignName,
        sheetUrl,
        headerRowIndex,
        importResult,
        emailField,
        subjectTemplate,
        bodyTemplate,
        startAt,
        delaySeconds,
        trackOpens,
        trackClicks,
        followUpSequence,
      };
      localStorage.setItem("campaign-draft", JSON.stringify(draft));
      setLastSavedAt(new Date());
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    campaignName,
    sheetUrl,
    headerRowIndex,
    importResult,
    emailField,
    subjectTemplate,
    bodyTemplate,
    startAt,
    delaySeconds,
    trackOpens,
    trackClicks,
    followUpSequence,
  ]);

  // Load draft on mount
  useEffect(() => {
    try {
      const draftStr = localStorage.getItem("campaign-draft");
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.campaignName) setCampaignName(draft.campaignName);
        if (draft.sheetUrl) setSheetUrl(draft.sheetUrl);
        if (draft.headerRowIndex !== undefined) setHeaderRowIndex(draft.headerRowIndex);
        if (draft.importResult) setImportResult(draft.importResult);
        if (draft.emailField) setEmailField(draft.emailField);
        if (draft.subjectTemplate) setSubjectTemplate(draft.subjectTemplate);
        if (draft.bodyTemplate) setBodyTemplate(draft.bodyTemplate);
        if (draft.startAt) setStartAt(draft.startAt);
        if (draft.delaySeconds) setDelaySeconds(draft.delaySeconds);
        if (draft.trackOpens !== undefined) setTrackOpens(draft.trackOpens);
        if (draft.trackClicks !== undefined) setTrackClicks(draft.trackClicks);
        if (draft.followUpSequence) setFollowUpSequence(draft.followUpSequence);
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
  }, []);

  const importMutation = useMutation({
    mutationFn: (url: string) => api.sheets.import(url),
    onSuccess: (data) => {
      try {
        const columns = Array.isArray(data.sheetSource?.columns) 
          ? data.sheetSource.columns 
          : Array.isArray(data.headers) 
          ? data.headers 
          : [];
        
        const rows = Array.isArray(data.records) ? data.records : [];
        
        const transformed = {
          columns: columns.map((col: any) => String(col)),
          headers: columns.map((col: any) => String(col)),
          rows: rows.map((row: any) => {
            const cleanRow: Record<string, string> = {};
            Object.keys(row || {}).forEach((key) => {
              const value = row[key];
              if (value === null || value === undefined) {
                cleanRow[key] = "";
              } else if (typeof value === "object") {
                cleanRow[key] = JSON.stringify(value);
              } else {
                cleanRow[key] = String(value);
              }
            });
            return cleanRow;
          }),
          records: rows,
          rowCount: rows.length,
          sheetSource: data.sheetSource,
        };
        
        setImportResult(transformed);
        setErrors({});
        
        if (transformed.columns && transformed.columns.length > 0) {
          const emailCol = transformed.columns.find((col: string) =>
            col.toLowerCase().includes("email")
          ) || transformed.columns[0];
          setEmailField(emailCol);
        }
      } catch (error) {
        console.error("Error processing sheet data:", error);
        setErrors({ sheet: "Failed to process sheet data. Please try again." });
      }
    },
    onError: (error: any) => {
      console.error("Import error:", error);
      setErrors({ sheet: error?.message || "Failed to import sheet. Please check the URL and try again." });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      
      if (!importResult || !emailField) {
        newErrors.audience = "Please import and select an email column from your sheet.";
      }
      
      if (!subjectTemplate.trim()) {
        newErrors.subject = "Email subject is required.";
      }
      
      if (!bodyTemplate.trim()) {
        newErrors.body = "Email body is required.";
      }
      
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error("Please fix the errors before submitting.");
      }
      
      const validRecipients = importResult.rows
        .map((row: Record<string, string>) => {
          const email = row[emailField]?.trim();
          if (!email || !email.includes("@")) {
            return null;
          }
          return {
            email,
            payload: row,
          };
        })
        .filter((r: { email: string; payload: Record<string, string> } | null): r is { email: string; payload: Record<string, string> } => r !== null);

      if (validRecipients.length === 0) {
        throw new Error("No valid email addresses found in the selected column. Please check your data.");
      }

      const campaignData: any = {
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        recipients: {
          emailField,
          rows: importResult.rows,
        },
        strategy: {
          startAt: new Date(startAt).toISOString(),
          delayMsBetweenEmails: delaySeconds * 1000,
          trackOpens,
          trackClicks,
          template: {
            subject: subjectTemplate.trim(),
            html: bodyTemplate.trim(),
            attachments: attachments.map((att) => ({
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
              size: att.size,
            })),
          },
        },
      };

      if (importResult.sheetSource?.id) {
        campaignData.sheetSourceId = importResult.sheetSource.id;
      }

      return api.campaigns.create(campaignData);
    },
    onSuccess: async (data) => {
      if (data?.id) {
        try {
          // Create follow-up sequence if exists
          if (followUpSequence && followUpSequence.steps.length > 0) {
            await api.followUps.create(data.id, {
              name: followUpSequence.name,
              steps: followUpSequence.steps.map((step) => {
                const result: any = {
                  subject: step.subject,
                  html: step.html,
                  sendAsReply: step.sendAsReply ?? false,
                  isNested: step.isNested ?? false,
                };
                if (step.useDateTime && step.scheduledAt) {
                  result.scheduledAt = step.scheduledAt;
                } else if (step.delayMs !== undefined) {
                  result.delayMs = step.delayMs;
                }
                if (step.parentStepId) {
                  result.parentStepId = step.parentStepId;
                }
                return result;
              }),
            });
          }

          await api.campaigns.schedule(data.id, startAt);
          setLaunchedCampaignId(data.id);
          setShowLaunchProgress(true);
          
          // Clear draft after successful launch
          localStorage.removeItem("campaign-draft");
        } catch (scheduleError: any) {
          console.error("Schedule error:", scheduleError);
          setErrors({ 
            launch: scheduleError?.message || "Campaign created but scheduling failed. Please schedule manually." 
          });
          // Still navigate to campaign page
          setTimeout(() => {
            router.push(`/campaigns/${data.id}`);
          }, 2000);
        }
      }
    },
    onError: (error: any) => {
      console.error("Create campaign error:", error);
      setErrors({ 
        launch: error?.message || "Failed to create campaign. Please check all fields and try again." 
      });
    },
  });

  const handleImport = () => {
    if (!sheetUrl.trim()) {
      setErrors({ sheet: "Please enter a Google Sheets URL" });
      return;
    }
    setErrors({});
    importMutation.mutate(sheetUrl);
  };

  const handleSaveDraft = () => {
    const now = new Date();
    setLastSavedAt(now);
    setSaveMessage("Draft saved");
    if (saveMessageTimeoutRef.current) {
      clearTimeout(saveMessageTimeoutRef.current);
    }
    saveMessageTimeoutRef.current = window.setTimeout(() => {
      setSaveMessage(null);
    }, 4000);
  };

  const handleLaunch = () => {
    setErrors({});
    if (!campaignName.trim()) {
      setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
    }
    createMutation.mutate();
  };

  // Preview rendering
  const filteredRecipients = useMemo(() => {
    if (!importResult || !searchQuery.trim()) return importResult?.rows ?? [];
    const lowercaseQuery = searchQuery.toLowerCase();
    return (importResult?.rows ?? []).filter((row: Record<string, string>) =>
      Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(lowercaseQuery)
      )
    );
  }, [importResult, searchQuery]);

  const safePreviewIndex = Math.min(
    Math.max(0, previewIndex),
    Math.max((filteredRecipients.length ?? 1) - 1, 0)
  );

  const previewData = filteredRecipients[safePreviewIndex] || {};
  
  const getPreviewValue = (key: string): string => {
    const value = previewData[key.trim()];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  
  const previewSubject = subjectTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));
  const previewBody = bodyTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));

  const isFormValid = importResult && emailField && subjectTemplate.trim() && bodyTemplate.trim();

  // Subject autocomplete handlers
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

  const subjectTokens = useMemo(() => findMergeFields(subjectTemplate), [subjectTemplate]);
  const bodyTokens = useMemo(() => findMergeFields(bodyTemplate), [bodyTemplate]);
  
  const missingTokens = useMemo(() => {
    if (!importResult || mergeFields.length === 0) return [] as string[];
    const allTokens = [...subjectTokens, ...bodyTokens];
    const lowerFields = new Set(mergeFields.map((field: string) => field.toLowerCase()));
    const missingSet = new Set<string>();
    for (const token of allTokens) {
      if (!lowerFields.has(token.toLowerCase())) {
        missingSet.add(token);
      }
    }
    return Array.from(missingSet);
  }, [importResult, mergeFields, subjectTokens, bodyTokens]);

  const updateSubjectAutocomplete = () => {
    const input = subjectInputRef.current;
    if (!input || !autocompleteEnabled || mergeFields.length === 0) {
      setSubjectAutocompleteState((state) => ({ ...state, open: false }));
      return;
    }

    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const match = prefix.match(/{{([\w.-]*)$/);

    if (!match) {
      setSubjectAutocompleteState((state) => ({ ...state, open: false }));
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
    if (!input) return;

    const value = input.value;
    const { tokenStart, caretIndex } = subjectAutocompleteState;
    const before = value.slice(0, tokenStart);
    const after = value.slice(caretIndex);
    const insertion = `{{${field}}}`;
    const nextValue = `${before}${insertion}${after}`;

    setSubjectTemplate(nextValue);
    setSubjectAutocompleteState((state) => ({ ...state, open: false }));

    requestAnimationFrame(() => {
      const nextCursor = before.length + insertion.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubjectTemplate(event.target.value);
    requestAnimationFrame(updateSubjectAutocomplete);
  };

  const handleSubjectKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!autocompleteEnabled) {
      if (event.key === "Escape") {
        setSubjectAutocompleteState((state) => ({ ...state, open: false }));
      }
      return;
    }

    if (!subjectAutocompleteState.open) {
      if (event.key === "{" || event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
        requestAnimationFrame(updateSubjectAutocomplete);
      }
      if (event.key === "Escape") {
        setSubjectAutocompleteState((state) => ({ ...state, open: false }));
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
          setSubjectAutocompleteState((state) => ({ ...state, open: false }));
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        setSubjectAutocompleteState((state) => ({ ...state, open: false }));
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

  const insertTokenIntoSubject = (token: string) => {
    if (!token) return;
    const trimmed = subjectTemplate.trimEnd();
    const spacer = trimmed.length > 0 && !trimmed.endsWith(" ") ? " " : "";
    const next = `${trimmed}${spacer}{{${token}}}`;
    setSubjectTemplate(next);
    setSubjectAutocompleteState((state) => ({ ...state, open: false }));
  };

  const recipientsCount = importResult?.rows?.length || 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-3 flex items-center gap-3 text-gray-900">
                  <Sparkles className="w-10 h-10 text-gray-900" />
                  Create Email Campaign
                </h1>
                <p className="text-lg text-gray-600">
                  Design, personalize, and launch your campaign from a single, clean interface.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowBestPractices(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg transition-colors hover:bg-black"
                >
                  <Info className="w-5 h-5 text-white" />
                  <span className="font-medium">Best Practices</span>
                </button>
                {lastSavedAt && (
                  <div className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
                    Saved at {lastSavedAt.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Main Form (2/3 width) */}
            <div className="xl:col-span-2 space-y-6">
              {/* Audience Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 p-6 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Import Recipients</h2>
                      <p className="text-gray-500 text-sm">Connect your Google Sheets to import contacts.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Sheets URL
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={sheetUrl}
                        onChange={(e) => {
                          setSheetUrl(e.target.value);
                          setErrors({});
                        }}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className={`flex-1 px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 ${
                          errors.sheet ? "border-red-300 bg-red-50" : "border-gray-300 bg-white hover:border-indigo-300"
                        }`}
                      />
                      <input
                        type="number"
                        min={0}
                        value={headerRowIndex}
                        onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
                        placeholder="Row"
                        className="w-20 px-3 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                      />
                      <button
                        onClick={handleImport}
                        disabled={importMutation.isPending}
                        className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {importMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-white" />
                            Import
                          </>
                        )}
                      </button>
                    </div>
                    {errors.sheet && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        {errors.sheet}
                      </p>
                    )}
                  </div>

                  {importMutation.isPending && (
                    <div className="text-center py-10">
                      <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-gray-600">Importing sheet data...</p>
                    </div>
                  )}

                  {importResult && (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-800">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-medium">
                            Imported {importResult.rowCount || 0} rows from your sheet
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Column
                        </label>
                        <select
                          value={emailField}
                          onChange={(e) => setEmailField(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-300"
                        >
                          <option value="">Select column...</option>
                          {importResult.columns?.map((col: string) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      {emailField && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                          <p className="text-sm text-gray-800 font-medium">
                            <strong>{importResult.rowCount || 0}</strong> recipients ready
                          </p>
                        </div>
                      )}

                      {/* Preview first few rows */}
                      {importResult.rows && importResult.rows.length > 0 && (
                        <div className="mt-4 overflow-x-auto border border-gray-200 rounded-xl bg-white">
                          <table className="w-full text-sm bg-white">
                            <thead className="bg-gray-50">
                              <tr>
                                {importResult.columns?.slice(0, 5).map((col: string) => (
                                  <th key={col} className="px-4 py-3 text-left font-semibold text-gray-900 border-b-2 border-gray-200 bg-gray-50">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {importResult.rows.slice(0, 3).map((row: Record<string, string>, idx: number) => (
                                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 bg-white">
                                  {importResult.columns?.slice(0, 5).map((col: string) => (
                                    <td key={col} className="px-4 py-2 text-gray-900 bg-white">
                                      {String(row[col] || "")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importResult.rows.length > 3 && (
                            <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                              Showing first 3 of {importResult.rows.length} rows
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Email Content Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 p-6 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Email Content</h2>
                      <p className="text-gray-500 text-sm">Craft your personalized email message.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="My Amazing Campaign"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-300 bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Subject Line
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAutocompleteEnabled(!autocompleteEnabled)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            autocompleteEnabled
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-700 border-gray-300"
                          }`}
                        >
                          {autocompleteEnabled ? "Autocomplete ON" : "Autocomplete OFF"}
                        </button>
                        {mergeFields.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                insertTokenIntoSubject(e.target.value);
                              }
                            }}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <option value="">Insert field...</option>
                            {mergeFields.map((field) => (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        ref={subjectInputRef}
                        type="text"
                        value={subjectTemplate}
                        onChange={handleSubjectChange}
                        onKeyDown={handleSubjectKeyDown}
                        onFocus={handleSubjectFocus}
                        onBlur={() => {
                          setTimeout(() => {
                            setSubjectAutocompleteState((state) => ({ ...state, open: false }));
                          }, 200);
                        }}
                        placeholder="Hello {{firstName}}, ready for an exciting opportunity?"
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-300 text-gray-900 ${
                          errors.subject ? "border-red-300 bg-red-50" : "border-gray-300 bg-white"
                        }`}
                      />
                      <MergeFieldAutocomplete
                        anchorRect={subjectAutocompleteState.anchorRect}
                        suggestions={subjectAutocompleteState.filtered}
                        highlightedIndex={subjectAutocompleteState.selectedIndex}
                        visible={subjectAutocompleteState.open && autocompleteEnabled}
                        onSelect={applySubjectSuggestion}
                        onHover={(index) =>
                          setSubjectAutocompleteState((state) => ({ ...state, selectedIndex: index }))
                        }
                      />
                    </div>
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        {errors.subject}
                      </p>
                    )}
                    {missingTokens.length > 0 && (
                      <p className="mt-1 text-sm text-orange-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        Missing merge fields: {missingTokens.join(", ")}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Email Body
                      </label>
                      <div className="flex items-center gap-2">
                        {mergeFields.length > 0 && (
                          <button
                            onClick={() => setShowMergeFields(!showMergeFields)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              showMergeFields
                                ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                                : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                            }`}
                          >
                            Merge Fields
                          </button>
                        )}
                      </div>
                    </div>

                    {showMergeFields && mergeFields.length > 0 && (
                      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="text-xs font-medium text-gray-800 mb-3">Available Merge Fields</div>
                        <div className="flex flex-wrap gap-2">
                          {mergeFields.map((col: string, idx: number) => (
                            <button
                              key={`merge-field-${idx}-${col}`}
                              type="button"
                              onClick={() => {
                                const field = `{{${col}}}`;
                                setBodyTemplate((prev) => prev + field);
                                richTextEditorRef.current?.focus();
                              }}
                              className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <RichTextEditor
                      ref={richTextEditorRef}
                      value={bodyTemplate}
                      onChange={(html) => setBodyTemplate(html)}
                      mergeFields={mergeFields}
                      autocompleteEnabled={autocompleteEnabled}
                      placeholder="Hi {{firstName}},&#10;&#10;I hope this email finds you well. I wanted to reach out because..."
                    />
                    {errors.body && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        {errors.body}
                      </p>
                    )}

                    {/* File Attachments */}
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attachments
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Add files to your email (max 25MB per file, 25MB total). Files are automatically scanned for viruses.
                      </p>
                      <input
                        type="file"
                        id="attachment-input"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          const MAX_SIZE = 25 * 1024 * 1024; // 25MB
                          const newAttachments: Attachment[] = [];

                          for (const file of files) {
                            if (file.size > MAX_SIZE) {
                              alert(`File "${file.name}" exceeds the 25MB limit. Please choose a smaller file.`);
                              continue;
                            }

                            try {
                              const base64 = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = reader.result as string;
                                  // Remove data URL prefix
                                  const base64Content = result.split(",")[1] || result;
                                  resolve(base64Content);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                              });

                              newAttachments.push({
                                filename: file.name,
                                content: base64,
                                contentType: file.type || undefined,
                                size: file.size,
                              });
                            } catch (error) {
                              console.error("Failed to read file:", error);
                              alert(`Failed to read file "${file.name}". Please try again.`);
                            }
                          }

                          // Check total size
                          const totalSize = [...attachments, ...newAttachments].reduce((sum, att) => sum + (att.size || 0), 0);
                          if (totalSize > MAX_SIZE) {
                            alert(`Total attachment size exceeds 25MB. Please remove some files.`);
                            return;
                          }

                          setAttachments([...attachments, ...newAttachments]);
                          // Reset input
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("attachment-input") as HTMLInputElement;
                          input?.click();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Paperclip className="w-4 h-4" />
                        Add Files
                      </button>
                      {attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {attachments.map((att, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-sm text-gray-900 truncate">{att.filename}</span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  ({(att.size || 0) / 1024 / 1024 < 1
                                    ? `${((att.size || 0) / 1024).toFixed(1)} KB`
                                    : `${((att.size || 0) / 1024 / 1024).toFixed(2)} MB`})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachments(attachments.filter((_, i) => i !== index));
                                }}
                                className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule & Settings Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 p-6 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Schedule & Settings</h2>
                      <p className="text-gray-500 text-sm">Configure when and how to send your campaign.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-300 bg-white text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delay Between Emails (seconds)
                      </label>
                      <input
                        type="number"
                        min="5"
                        value={delaySeconds}
                        onChange={(e) => setDelaySeconds(Math.max(5, Number(e.target.value)))}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all hover:border-indigo-300 bg-white text-gray-900"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 5 seconds to avoid rate limiting
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-gray-900" />
                      Tracking Options
                    </h3>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-all">
                      <input
                        type="checkbox"
                        checked={trackOpens}
                        onChange={(e) => setTrackOpens(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Track email opens</span>
                        <p className="text-xs text-gray-500">Monitor when recipients open your emails</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-all">
                      <input
                        type="checkbox"
                        checked={trackClicks}
                        onChange={(e) => setTrackClicks(e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Track link clicks</span>
                        <p className="text-xs text-gray-500">Monitor which links recipients click</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Follow-up Sequence Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 p-6 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Follow-up Sequence</h2>
                        <p className="text-gray-500 text-sm">Automate follow-ups for non-responders.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowFollowUps(!showFollowUps)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {showFollowUps ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                {showFollowUps && (
                  <div className="p-6">
                    <div className="text-sm text-gray-600 mb-4">
                      {followUpSequence && followUpSequence.steps.length > 0
                        ? `${followUpSequence.steps.length} follow-up step${followUpSequence.steps.length === 1 ? "" : "s"} configured`
                        : "No follow-ups configured yet. Click below to add follow-up sequences."}
                    </div>
                    {followUpSequence && followUpSequence.steps.length > 0 && (
                      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <div className="font-semibold text-gray-900 mb-2">{followUpSequence.name}</div>
                        <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                          {followUpSequence.steps.map((step, idx) => {
                            const delay = step.delayMs ? Math.round(step.delayMs / (60 * 60 * 1000)) : 48;
                            const timing = step.useDateTime && step.scheduledAt
                              ? new Date(step.scheduledAt).toLocaleString()
                              : `${delay} hours later`;
                            return (
                              <li key={idx}>
                                {timing} - {step.subject}
                                {step.sendAsReply && <span className="text-xs"> (as reply)</span>}
                                {step.isNested && <span className="text-xs"> (nested)</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => setShowFollowUpBuilder(true)}
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5 text-white" />
                      {followUpSequence && followUpSequence.steps.length > 0 ? "Edit Follow-ups" : "Add Follow-ups"}
                    </button>
                  </div>
                )}
              </div>

              {/* Launch Button */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                {errors.launch && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="w-5 h-5 text-red-800" />
                      <span className="font-medium">{errors.launch}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-gray-700">
                    <button
                      onClick={handleSaveDraft}
                      className="px-4 py-2 border border-gray-300 rounded-lg transition-colors hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Save className="w-4 h-4 text-gray-700" />
                      Save Draft
                    </button>
                    {saveMessage && (
                      <span className="text-sm text-green-600">{saveMessage}</span>
                    )}
                  </div>
                  <button
                    onClick={handleLaunch}
                    disabled={!isFormValid || createMutation.isPending}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-sm"
                  >
                    {createMutation.isPending ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin text-white" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Send className="w-6 h-6 text-white" />
                        Launch Campaign
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Preview Sidebar (1/3 width) */}
            {showPreview && (
              <div className="xl:col-span-1">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-indigo-600" />
                      Preview
                    </h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Recipient Navigator */}
                  {importResult && filteredRecipients.length > 0 && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-900">
                          Recipient {safePreviewIndex + 1} of {filteredRecipients.length}
                        </span>
                        <button
                          onClick={() => setIsSearchOpen(!isSearchOpen)}
                          className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Search className="w-3 h-3 text-gray-700" />
                          Search
                        </button>
                      </div>
                      {isSearchOpen && (
                        <div className="mb-2">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setPreviewIndex(0);
                            }}
                            placeholder="Filter recipients..."
                            className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                          disabled={safePreviewIndex === 0}
                          className="p-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-4 h-4 text-blue-700" />
                        </button>
                        <button
                          onClick={() => setPreviewIndex((prev) => Math.min(filteredRecipients.length - 1, prev + 1))}
                          disabled={safePreviewIndex >= filteredRecipients.length - 1}
                          className="p-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-4 h-4 text-blue-700" />
                        </button>
                        <div className="flex-1 text-xs text-blue-700">
                          {Object.entries(previewData).slice(0, 2).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              <strong>{key}:</strong> {String(value).slice(0, 20)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1 font-medium">Subject</div>
                      <div className="text-sm font-semibold text-gray-900">{previewSubject || "(No subject)"}</div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
                      <div className="text-xs text-gray-500 mb-2 font-medium">Body</div>
                      <div
                        className="text-sm text-gray-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewBody || "(No body)" }}
                      />
                    </div>
                    {importResult && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                        <div className="text-xs font-medium text-green-900 mb-1">Recipients</div>
                        <div className="text-sm text-green-700 font-semibold">{importResult.rowCount || 0} contacts</div>
                      </div>
                    )}
                    {missingTokens.length > 0 && (
                      <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200">
                        <div className="text-xs font-medium text-red-900 mb-2">Missing Merge Fields:</div>
                        <ul className="text-xs text-red-700 list-disc list-inside">
                          {missingTokens.map((token) => (
                            <li key={token}>{token}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Best Practices Modal */}
      <EmailBestPracticesModal
        isOpen={showBestPractices}
        onClose={() => setShowBestPractices(false)}
      />

      {/* Follow-up Sequence Builder */}
      {showFollowUpBuilder && (
        <FollowUpSequenceBuilder
          initialSequence={followUpSequence}
          mergeFields={mergeFields}
          onSave={(sequence) => {
            setFollowUpSequence(sequence);
            setShowFollowUpBuilder(false);
          }}
          onClose={() => setShowFollowUpBuilder(false)}
        />
      )}

      {/* Campaign Launch Progress */}
      <CampaignLaunchProgress
        campaignId={launchedCampaignId}
        isOpen={showLaunchProgress}
        onClose={() => {
          setShowLaunchProgress(false);
          if (launchedCampaignId) {
            router.push(`/campaigns/${launchedCampaignId}`);
          }
        }}
        onComplete={() => {
          setTimeout(() => {
            if (launchedCampaignId) {
              router.push(`/campaigns/${launchedCampaignId}`);
            }
          }, 2000);
        }}
      />
    </Layout>
  );
}
