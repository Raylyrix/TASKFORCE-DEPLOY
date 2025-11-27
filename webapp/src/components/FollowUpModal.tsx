"use client";

import { useState } from "react";
import { X, Plus, Trash2, Clock, Calendar, Mail, Reply, Send } from "lucide-react";

type FollowUpStep = {
  id: string;
  subject: string;
  html: string;
  delayMs?: number;
  scheduledAt?: string;
  sendAsReply: boolean;
  replyToMessageId?: string;
  replyToThreadId?: string;
  useDateTime: boolean; // true = use date/time, false = use hours
  parentStepId?: string; // For nested follow-ups
  isNested: boolean; // Whether this is a nested (child) follow-up
};

type FollowUpModalProps = {
  campaignId: string;
  onClose: () => void;
  onSave: (data: { name: string; steps: FollowUpStep[] }) => void;
  isSaving?: boolean;
  existingMessages?: Array<{ id: string; threadId: string; subject: string; to: string }>; // For reply selection
};

export default function FollowUpModal({
  campaignId,
  onClose,
  onSave,
  isSaving = false,
  existingMessages = [],
}: FollowUpModalProps) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<FollowUpStep[]>([
    {
      id: "1",
      subject: "",
      html: "",
      delayMs: 24 * 60 * 60 * 1000, // 24 hours default
      sendAsReply: false,
      useDateTime: false,
      isNested: false,
    },
  ]);

  const addStep = (parentStepId?: string) => {
    const newStep: FollowUpStep = {
      id: Date.now().toString(),
      subject: "",
      html: "",
      delayMs: 24 * 60 * 60 * 1000,
      sendAsReply: false,
      useDateTime: false,
      isNested: !!parentStepId,
      parentStepId: parentStepId,
    };
    setSteps([...steps, newStep]);
  };

  const addNestedStep = (parentStepId: string) => {
    addStep(parentStepId);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<FollowUpStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a sequence name");
      return;
    }

    if (steps.some((s) => !s.subject.trim() || !s.html.trim())) {
      alert("Please fill in all step subjects and content");
      return;
    }

    // Convert steps to API format
    const apiSteps = steps.map((step) => {
      const result: any = {
        subject: step.subject,
        html: step.html,
        sendAsReply: step.sendAsReply,
      };

      if (step.useDateTime && step.scheduledAt) {
        result.scheduledAt = step.scheduledAt;
      } else if (step.delayMs !== undefined) {
        result.delayMs = step.delayMs;
      }

      if (step.sendAsReply) {
        if (step.replyToMessageId) {
          result.replyToMessageId = step.replyToMessageId;
        }
        if (step.replyToThreadId) {
          result.replyToThreadId = step.replyToThreadId;
        }
      }

      if (step.isNested && step.parentStepId) {
        result.parentStepId = step.parentStepId;
        result.isNested = true;
      }

      return result;
    });

    onSave({ name, steps: apiSteps });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">Create Follow-up Sequence</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sequence Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sequence Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 3-Day Follow-up Sequence"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Follow-up Steps</h3>
              <button
                onClick={() => addStep()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
            </div>

            {steps.map((step, index) => (
              <div
                key={step.id}
                className="p-4 border border-gray-200 rounded-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Step {index + 1}</h4>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={step.subject}
                    onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                    placeholder="Follow-up email subject"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={step.html}
                    onChange={(e) => updateStep(step.id, { html: e.target.value })}
                    placeholder="Enter your follow-up email content (HTML supported)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-h-[150px]"
                    required
                  />
                </div>

                {/* Timing Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timing Method
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!step.useDateTime}
                          onChange={() => updateStep(step.id, { useDateTime: false })}
                          className="text-primary-600"
                        />
                        <span className="text-sm text-gray-700">Hours Delay</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={step.useDateTime}
                          onChange={() => updateStep(step.id, { useDateTime: true })}
                          className="text-primary-600"
                        />
                        <span className="text-sm text-gray-700">Date & Time</span>
                      </label>
                    </div>
                  </div>

                  {!step.useDateTime ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delay (Hours)
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min="0"
                          value={step.delayMs ? Math.round(step.delayMs / (60 * 60 * 1000)) : 0}
                          onChange={(e) =>
                            updateStep(step.id, {
                              delayMs: parseInt(e.target.value) * 60 * 60 * 1000,
                            })
                          }
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Scheduled Date & Time
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="datetime-local"
                          value={
                            step.scheduledAt
                              ? new Date(step.scheduledAt).toISOString().slice(0, 16)
                              : ""
                          }
                          onChange={(e) =>
                            updateStep(step.id, {
                              scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                            })
                          }
                          min={new Date().toISOString().slice(0, 16)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply vs Separate Email */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.sendAsReply}
                      onChange={(e) => updateStep(step.id, { sendAsReply: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      {step.sendAsReply ? (
                        <Reply className="w-4 h-4 text-primary-600" />
                      ) : (
                        <Send className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        Send as Reply (to original email thread)
                      </span>
                    </div>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    {step.sendAsReply
                      ? "This follow-up will be sent as a reply to the original email, keeping the conversation thread together."
                      : "This follow-up will be sent as a separate new email."}
                  </p>

                  {/* Reply Target Selection (if sendAsReply is enabled) */}
                  {step.sendAsReply && existingMessages.length > 0 && (
                    <div className="mt-3 ml-7">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reply To (Optional)
                      </label>
                      <select
                        value={step.replyToMessageId || ""}
                        onChange={(e) => {
                          const selected = existingMessages.find((m) => m.id === e.target.value);
                          updateStep(step.id, {
                            replyToMessageId: e.target.value || undefined,
                            replyToThreadId: selected?.threadId,
                          });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Use original campaign message</option>
                        {existingMessages.map((msg) => (
                          <option key={msg.id} value={msg.id}>
                            {msg.subject} - {msg.to}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Select a specific message to reply to, or leave blank to reply to the original campaign message.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Create Sequence
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

