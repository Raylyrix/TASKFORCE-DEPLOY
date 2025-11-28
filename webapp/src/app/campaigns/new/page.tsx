"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatISO, addMinutes } from "date-fns";
import {
  Mail,
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
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
} from "lucide-react";

type StepId = "audience" | "email" | "schedule" | "review";

type StepConfig = {
  id: StepId;
  title: string;
  description: string;
};

const steps: StepConfig[] = [
  { id: "audience", title: "Audience", description: "Import recipients" },
  { id: "email", title: "Email", description: "Craft your message" },
  { id: "schedule", title: "Schedule", description: "Set send time" },
  { id: "review", title: "Review", description: "Final check" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepId>("audience");
  const [campaignName, setCampaignName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [emailField, setEmailField] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [startAt, setStartAt] = useState(formatISO(addMinutes(new Date(), 5)).slice(0, 16));
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [selectedMeetingType, setSelectedMeetingType] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const { data: meetingTypes } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  const importMutation = useMutation({
    mutationFn: (url: string) => api.sheets.import(url),
    onSuccess: (data) => {
      // Transform the response to match what we expect
      // Ensure columns is always an array of strings
      const columns = Array.isArray(data.sheetSource?.columns) 
        ? data.sheetSource.columns 
        : Array.isArray(data.headers) 
        ? data.headers 
        : [];
      
      // Ensure rows is always an array
      const rows = Array.isArray(data.records) ? data.records : [];
      
      const transformed = {
        columns: columns.map((col: any) => String(col)), // Ensure all columns are strings
        rows: rows.map((row: any) => {
          // Ensure all row values are strings or primitives
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
        rowCount: rows.length,
      };
      setImportResult(transformed);
      if (transformed.columns && transformed.columns.length > 0) {
        // Auto-select first column that looks like email
        const emailCol = transformed.columns.find((col: string) =>
          col.toLowerCase().includes("email")
        ) || transformed.columns[0];
        setEmailField(emailCol);
      }
    },
    onError: (error: any) => {
      console.error("Import error:", error);
      alert(error?.message || "Failed to import sheet. Please check the URL and try again.");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!importResult || !emailField) throw new Error("Missing recipients");
      
      // Validate email field exists in rows
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
        .filter((r): r is { email: string; payload: Record<string, string> } => r !== null);

      if (validRecipients.length === 0) {
        throw new Error("No valid email addresses found in the selected column. Please check your data.");
      }

      if (!subjectTemplate.trim()) {
        throw new Error("Email subject is required.");
      }

      if (!bodyTemplate.trim()) {
        throw new Error("Email body is required.");
      }

      return api.campaigns.create({
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
          },
        },
      });
    },
    onSuccess: async (data) => {
      try {
        // Schedule the campaign
        await api.campaigns.schedule(data.id, new Date(startAt).toISOString());
        router.push(`/campaigns/${data.id}`);
      } catch (error: any) {
        console.error("Schedule error:", error);
        alert(error?.message || "Campaign created but failed to schedule. Please schedule it manually.");
        router.push(`/campaigns/${data.id}`);
      }
    },
    onError: (error: any) => {
      console.error("Create campaign error:", error);
      alert(error?.message || "Failed to create campaign. Please check all fields and try again.");
    },
  });

  const handleImport = () => {
    if (!sheetUrl.trim()) {
      alert("Please enter a Google Sheets URL");
      return;
    }
    importMutation.mutate(sheetUrl);
  };

  const handleInsertMeetingLink = (meetingTypeId: string) => {
    const meeting = meetingTypes?.find((mt: any) => mt.id === meetingTypeId);
    if (!meeting || !meeting.bookingLinks || meeting.bookingLinks.length === 0) {
      alert("No booking link available for this meeting type");
      return;
    }
    
    const bookingLink = meeting.bookingLinks[0];
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const link = `${backendUrl}/book/${bookingLink.token}`;
    setMeetingLink(link);
    setSelectedMeetingType(meetingTypeId);
    
    // Insert link into body
    const linkHtml = `<p><strong>Schedule time:</strong> <a href="${link}" target="_blank" rel="noopener">${meeting.name} - pick a time that works for you</a></p>`;
    setBodyTemplate((prev) => (prev ? `${prev}\n${linkHtml}` : linkHtml));
  };

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const canProceed = 
    (currentStep === "audience" && importResult && emailField) ||
    (currentStep === "email" && subjectTemplate.trim() && bodyTemplate.trim()) ||
    (currentStep === "schedule") ||
    (currentStep === "review");

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1 && canProceed) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const handleLaunch = () => {
    if (!campaignName.trim()) {
      setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
    }
    createMutation.mutate();
  };

  // Preview rendering
  const previewData = importResult?.rows?.[0] || {};
  // Helper to safely convert values to strings (prevents React error #31)
  const getPreviewValue = (key: string): string => {
    const value = previewData[key.trim()];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  const previewSubject = subjectTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));
  const previewBody = bodyTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Campaign</h1>
          <p className="text-gray-600 mt-1">Build and launch your email campaign</p>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isComplete = currentStepIndex > index;
              const canAccess = index <= currentStepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => canAccess && setCurrentStep(step.id)}
                    disabled={!canAccess}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : isComplete
                        ? "text-gray-600 hover:bg-gray-50"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isActive || isComplete
                          ? "bg-primary-600 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {isComplete ? <CheckCircle className="w-5 h-5" /> : index + 1}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{step.title}</div>
                      <div className="text-xs opacity-75">{step.description}</div>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {currentStep === "audience" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Import Recipients</h2>
                    <p className="text-gray-600 text-sm">
                      Import your recipients from a Google Sheets URL. Make sure the sheet is publicly accessible.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Sheets URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleImport}
                        disabled={importMutation.isPending}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Import
                      </button>
                    </div>
                  </div>

                  {importMutation.isPending && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="text-sm text-gray-600 mt-2">Importing sheet...</p>
                    </div>
                  )}

                  {importResult && (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">
                            Imported {importResult.rows?.length || 0} rows
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
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
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>{importResult.rows?.length || 0}</strong> recipients ready
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStep === "email" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Content</h2>
                    <p className="text-gray-600 text-sm">
                      Write your email subject and body. Use {"{{fieldName}}"} for personalization.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="My Campaign"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Subject
                      </label>
                      {importResult && importResult.columns && importResult.columns.length > 0 && (
                        <div className="text-xs text-gray-500">
                          Available fields: {importResult.columns.slice(0, 5).join(", ")}
                          {importResult.columns.length > 5 && ` +${importResult.columns.length - 5} more`}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={subjectTemplate}
                      onChange={(e) => setSubjectTemplate(e.target.value)}
                      placeholder="Hello {{firstName}}"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use {"{{fieldName}}"} to insert merge fields from your sheet
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Body
                      </label>
                      <div className="flex items-center gap-2">
                        {meetingTypes && meetingTypes.length > 0 && (
                          <select
                            value={selectedMeetingType || ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleInsertMeetingLink(e.target.value);
                              }
                            }}
                            className="text-sm px-3 py-1 border border-gray-300 rounded-lg"
                          >
                            <option value="">Insert meeting link...</option>
                            {meetingTypes.map((mt: any) => (
                              <option key={mt.id} value={mt.id}>
                                {mt.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="p-2 rounded-lg hover:bg-gray-100"
                        >
                          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {importResult && importResult.columns && importResult.columns.length > 0 && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs font-medium text-blue-900 mb-1">Available Merge Fields:</div>
                        <div className="flex flex-wrap gap-1">
                          {importResult.columns.map((col: string) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                const field = `{{${col}}}`;
                                setBodyTemplate((prev) => prev + field);
                              }}
                              className="px-2 py-1 text-xs bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <textarea
                      value={bodyTemplate}
                      onChange={(e) => setBodyTemplate(e.target.value)}
                      placeholder="Hi {{firstName}},&#10;&#10;This is a personalized email..."
                      rows={12}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use HTML for formatting. Click merge fields above or type {"{{fieldName}}"}
                    </p>
                  </div>
                </div>
              )}

              {currentStep === "schedule" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Schedule & Settings</h2>
                    <p className="text-gray-600 text-sm">Configure when and how to send your campaign</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delay Between Emails (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trackOpens}
                        onChange={(e) => setTrackOpens(e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Track email opens</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trackClicks}
                        onChange={(e) => setTrackClicks(e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Track link clicks</span>
                    </label>
                  </div>
                </div>
              )}

              {currentStep === "review" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Campaign</h2>
                    <p className="text-gray-600 text-sm">Review all settings before launching</p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">Campaign Name</div>
                      <div className="text-gray-900">{campaignName || "Untitled Campaign"}</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">Recipients</div>
                      <div className="text-gray-900">{importResult?.rows?.length || 0} recipients</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">Start Time</div>
                      <div className="text-gray-900">
                        {new Date(startAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-1">Delay</div>
                      <div className="text-gray-900">{delaySeconds} seconds between emails</div>
                    </div>
                  </div>

                  {!canProceed && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">Please complete all previous steps</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentStep === "review" ? (
                <button
                  onClick={handleLaunch}
                  disabled={!canProceed || createMutation.isPending}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Launching...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Launch Campaign
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={!canProceed}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Preview Sidebar */}
          {showPreview && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Subject</div>
                    <div className="text-sm font-medium text-gray-900">{previewSubject || "(No subject)"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Body</div>
                    <div
                      className="text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewBody || "(No body)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

