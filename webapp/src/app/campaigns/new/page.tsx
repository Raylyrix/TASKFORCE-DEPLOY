"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { EmailBestPracticesModal } from "@/components/EmailBestPracticesModal";
import { CampaignLaunchProgress } from "@/components/CampaignLaunchProgress";

export default function NewCampaignPage() {
  const router = useRouter();
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
  const [showBestPractices, setShowBestPractices] = useState(false);
  const [showLaunchProgress, setShowLaunchProgress] = useState(false);
  const [launchedCampaignId, setLaunchedCampaignId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"audience" | "content" | "schedule">("audience");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: meetingTypes } = useQuery({
    queryKey: ["meeting-types"],
    queryFn: () => api.calendar.getMeetingTypes(),
  });

  const importMutation = useMutation({
    mutationFn: (url: string) => api.sheets.import(url),
    onSuccess: (data) => {
      try {
        // Transform the response to match what we expect
        const columns = Array.isArray(data.sheetSource?.columns) 
          ? data.sheetSource.columns 
          : Array.isArray(data.headers) 
          ? data.headers 
          : [];
        
        const rows = Array.isArray(data.records) ? data.records : [];
        
        const transformed = {
          columns: columns.map((col: any) => String(col)),
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
          rowCount: rows.length,
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
      // Validation
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
        .filter((r: { email: string; payload: Record<string, string> } | null): r is { email: string; payload: Record<string, string> } => r !== null);

      if (validRecipients.length === 0) {
        throw new Error("No valid email addresses found in the selected column. Please check your data.");
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
      if (data?.id) {
        try {
          await api.campaigns.schedule(data.id, startAt);
          setLaunchedCampaignId(data.id);
          setShowLaunchProgress(true);
        } catch (scheduleError: any) {
          console.error("Schedule error:", scheduleError);
          alert(scheduleError?.message || "Campaign created but scheduling failed. Please schedule manually.");
          router.push(`/campaigns/${data.id}`);
        }
      }
    },
    onError: (error: any) => {
      console.error("Create campaign error:", error);
      alert(error?.message || "Failed to create campaign. Please check all fields and try again.");
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
    
    const linkHtml = `<p><strong>Schedule time:</strong> <a href="${link}" target="_blank" rel="noopener">${meeting.name} - pick a time that works for you</a></p>`;
    setBodyTemplate((prev) => (prev ? `${prev}\n${linkHtml}` : linkHtml));
  };

  const handleLaunch = () => {
    setErrors({});
    if (!campaignName.trim()) {
      setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
    }
    createMutation.mutate();
  };

  // Preview rendering
  const previewData = importResult?.rows?.[0] || {};
  const getPreviewValue = (key: string): string => {
    const value = previewData[key.trim()];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };
  const previewSubject = subjectTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));
  const previewBody = bodyTemplate.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => getPreviewValue(key));

  const isFormValid = importResult && emailField && subjectTemplate.trim() && bodyTemplate.trim();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Email Campaign</h1>
            <p className="text-lg text-gray-600">Design, personalize, and launch your email campaign in one place</p>
          </div>
          <button
            onClick={() => setShowBestPractices(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-200 shadow-sm"
          >
            <Info className="w-5 h-5" />
            <span className="font-medium">Best Practices</span>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-center gap-4">
            {[
              { id: "audience", label: "Audience", icon: Users },
              { id: "content", label: "Content", icon: FileText },
              { id: "schedule", label: "Schedule", icon: Calendar },
            ].map((section, index) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const isComplete = 
                (section.id === "audience" && importResult && emailField) ||
                (section.id === "content" && subjectTemplate.trim() && bodyTemplate.trim()) ||
                (section.id === "schedule");

              return (
                <div key={section.id} className="flex items-center">
                  <button
                    onClick={() => setActiveSection(section.id as any)}
                    className={`flex flex-col items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : isComplete
                        ? "text-gray-600 hover:bg-gray-50"
                        : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : isComplete
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {isComplete && !isActive ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                  {index < 2 && (
                    <ArrowRight className="w-5 h-5 text-gray-300 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Audience Section */}
            {activeSection === "audience" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Import Recipients</h2>
                    <p className="text-sm text-gray-600">Connect your Google Sheets to import contacts</p>
                  </div>
                </div>

                <div className="space-y-6">
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
                        className={`flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                          errors.sheet ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      <button
                        onClick={handleImport}
                        disabled={importMutation.isPending}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm font-medium"
                      >
                        {importMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Import
                          </>
                        )}
                      </button>
                    </div>
                    {errors.sheet && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.sheet}
                      </p>
                    )}
                  </div>

                  {importMutation.isPending && (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-sm text-gray-600">Importing sheet data...</p>
                    </div>
                  )}

                  {importResult && (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium">
                            Successfully imported {importResult.rowCount || 0} rows
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                          <p className="text-sm text-indigo-800">
                            <strong>{importResult.rowCount || 0}</strong> recipients ready to receive your campaign
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Section */}
            {activeSection === "content" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Email Content</h2>
                    <p className="text-sm text-gray-600">Craft your personalized email message</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="My Campaign"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Subject Line
                      </label>
                      {importResult && importResult.columns && importResult.columns.length > 0 && (
                        <span className="text-xs text-gray-500">
                          Available fields: {importResult.columns.slice(0, 3).join(", ")}
                          {importResult.columns.length > 3 && ` +${importResult.columns.length - 3} more`}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={subjectTemplate}
                      onChange={(e) => {
                        setSubjectTemplate(e.target.value);
                        setErrors({});
                      }}
                      placeholder="Hello {{firstName}}"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        errors.subject ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                    />
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Use {"{{fieldName}}"} to insert merge fields from your sheet
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Email Body
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
                            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
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
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title={showPreview ? "Hide preview" : "Show preview"}
                        >
                          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {importResult && importResult.columns && importResult.columns.length > 0 && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs font-medium text-blue-900 mb-2">Available Merge Fields:</div>
                        <div className="flex flex-wrap gap-2">
                          {importResult.columns.map((col: string) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                const field = `{{${col}}}`;
                                setBodyTemplate((prev) => prev + field);
                              }}
                              className="px-2.5 py-1 text-xs bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium"
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <textarea
                      value={bodyTemplate}
                      onChange={(e) => {
                        setBodyTemplate(e.target.value);
                        setErrors({});
                      }}
                      placeholder="Hi {{firstName}},&#10;&#10;This is a personalized email..."
                      rows={14}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm ${
                        errors.body ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                    />
                    {errors.body && (
                      <p className="mt-1 text-sm text-red-600">{errors.body}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Use HTML for formatting. Click merge fields above or type {"{{fieldName}}"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Section */}
            {activeSection === "schedule" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Schedule & Settings</h2>
                    <p className="text-sm text-gray-600">Configure when and how to send your campaign</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Wait time between sending each email to avoid rate limiting
                    </p>
                  </div>

                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
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
                    <label className="flex items-center gap-3 cursor-pointer">
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
            )}

            {/* Launch Button */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {activeSection !== "audience" && (
                  <button
                    onClick={() => {
                      if (activeSection === "content") setActiveSection("audience");
                      else if (activeSection === "schedule") setActiveSection("content");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    Previous
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {activeSection !== "schedule" && (
                  <button
                    onClick={() => {
                      if (activeSection === "audience") setActiveSection("content");
                      else if (activeSection === "content") setActiveSection("schedule");
                    }}
                    disabled={
                      (activeSection === "audience" && (!importResult || !emailField)) ||
                      (activeSection === "content" && (!subjectTemplate.trim() || !bodyTemplate.trim()))
                    }
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                
                {activeSection === "schedule" && (
                  <button
                    onClick={handleLaunch}
                    disabled={!isFormValid || createMutation.isPending}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Launching...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Launch Campaign
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preview Sidebar */}
          {showPreview && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-1 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Subject</div>
                    <div className="text-sm font-medium text-gray-900">{previewSubject || "(No subject)"}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Body</div>
                    <div
                      className="text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewBody || "(No body)" }}
                    />
                  </div>
                  {importResult && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs font-medium text-blue-900 mb-1">Recipients</div>
                      <div className="text-sm text-blue-700">{importResult.rowCount || 0} contacts</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Best Practices Modal */}
      <EmailBestPracticesModal
        isOpen={showBestPractices}
        onClose={() => setShowBestPractices(false)}
      />

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
