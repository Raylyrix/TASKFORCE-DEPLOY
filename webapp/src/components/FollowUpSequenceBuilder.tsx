"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Clock, Calendar, Mail, Reply, Send, RefreshCw, AlertCircle } from "lucide-react";
import { RichTextEditor, type RichTextEditorHandle } from "./RichTextEditor";

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

type FollowUpSequenceBuilderProps = {
  initialSequence?: FollowUpSequence | null;
  mergeFields: string[];
  onSave: (sequence: FollowUpSequence | null) => void;
  onClose: () => void;
};

export function FollowUpSequenceBuilder({
  initialSequence,
  mergeFields,
  onSave,
  onClose,
}: FollowUpSequenceBuilderProps) {
  const [name, setName] = useState(initialSequence?.name || "");
  const [steps, setSteps] = useState<FollowUpStep[]>(
    initialSequence?.steps || [
      {
        id: "1",
        subject: "",
        html: "",
        delayMs: 48 * 60 * 60 * 1000, // 48 hours default
        sendAsReply: false,
        useDateTime: false,
        isNested: false,
      },
    ]
  );

  const defaultStep = (parentStepId?: string): FollowUpStep => {
    const defaultDelay = 48 * 60 * 60 * 1000; // 48 hours
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      subject: "",
      html: "",
      delayMs: defaultDelay,
      sendAsReply: false,
      useDateTime: false,
      isNested: !!parentStepId,
      parentStepId: parentStepId,
    };
  };

  const addStep = (parentStepId?: string) => {
    const newStep = defaultStep(parentStepId);
    setSteps([...steps, newStep]);
  };

  const addNestedStep = (parentStepId: string) => {
    const newStep = defaultStep(parentStepId);
    // Insert after the parent step
    const parentIndex = steps.findIndex((s) => s.id === parentStepId);
    if (parentIndex >= 0) {
      const newSteps = [...steps];
      newSteps.splice(parentIndex + 1, 0, newStep);
      setSteps(newSteps);
    } else {
      setSteps([...steps, newStep]);
    }
  };

  const removeStep = (id: string) => {
    // Also remove nested steps
    const stepIdsToRemove = new Set([id]);
    const findNestedSteps = (parentId: string) => {
      steps.forEach((step) => {
        if (step.parentStepId === parentId) {
          stepIdsToRemove.add(step.id);
          findNestedSteps(step.id);
        }
      });
    };
    findNestedSteps(id);
    setSteps(steps.filter((s) => !stepIdsToRemove.has(s.id)));
  };

  const updateStep = (id: string, updates: Partial<FollowUpStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);

    if (steps.length === 0 || steps.every((s) => !s.subject.trim() && !s.html.trim())) {
      onSave(null);
      onClose();
      return;
    }

    if (!name.trim()) {
      setError("Please enter a sequence name");
      return;
    }

    // Filter out empty steps
    const validSteps = steps.filter((s) => s.subject.trim() && s.html.trim());
    
    if (validSteps.length === 0) {
      setError("Please add at least one follow-up step with subject and content");
      return;
    }

    // Ensure all steps have proper timing
    const validatedSteps = validSteps.map((step) => {
      const result = { ...step };
      if (result.useDateTime && !result.scheduledAt) {
        // Default to 48 hours from now if date/time not set
        const defaultDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
        result.scheduledAt = defaultDate.toISOString();
        result.useDateTime = false;
        result.delayMs = 48 * 60 * 60 * 1000;
      } else if (!result.useDateTime && !result.delayMs) {
        result.delayMs = 48 * 60 * 60 * 1000;
      }
      return result;
    });

    onSave({
      name: name.trim(),
      steps: validatedSteps,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Follow-up Sequence Builder</h2>
            <p className="text-orange-100 text-sm mt-1">
              Build automated follow-ups for non-responders
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Sequence Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sequence Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., 3-Day Follow-up Sequence"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Follow-up Steps</h3>
              <button
                onClick={() => addStep()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all font-medium shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Add Step
              </button>
            </div>

            {steps.map((step, index) => (
              <StepEditor
                key={step.id}
                step={step}
                index={index}
                mergeFields={mergeFields}
                onUpdate={(updates) => updateStep(step.id, updates)}
                onRemove={() => removeStep(step.id)}
                onAddNested={() => addNestedStep(step.id)}
                canRemove={steps.length > 1}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-700 hover:text-gray-900 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all font-medium shadow-lg flex items-center gap-2"
          >
            <Mail className="w-5 h-5" />
            Save Sequence
          </button>
        </div>
      </div>
    </div>
  );
}

function StepEditor({
  step,
  index,
  mergeFields,
  onUpdate,
  onRemove,
  onAddNested,
  canRemove,
}: {
  step: FollowUpStep;
  index: number;
  mergeFields: string[];
  onUpdate: (updates: Partial<FollowUpStep>) => void;
  onRemove: () => void;
  onAddNested: () => void;
  canRemove: boolean;
}) {
  const editorRef = useRef<RichTextEditorHandle | null>(null);

  return (
    <div
      className={`p-6 border-2 rounded-xl space-y-4 transition-all ${
        step.isNested
          ? "bg-blue-50 border-blue-300 ml-8"
          : "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-900 flex items-center gap-2">
          {step.isNested && <span className="text-blue-600">↳</span>}
          Step {index + 1}
          {step.isNested && (
            <span className="text-xs font-normal text-blue-600">(Nested)</span>
          )}
        </h4>
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
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
          onChange={(e) => onUpdate({ subject: e.target.value })}
          placeholder="Follow-up email subject"
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          required
        />
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Content <span className="text-red-500">*</span>
        </label>
        <RichTextEditor
          ref={editorRef}
          value={step.html}
          onChange={(html) => onUpdate({ html })}
          mergeFields={mergeFields}
          placeholder="Enter your follow-up email content..."
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
                name={`schedule-mode-${step.id}`}
                checked={!step.useDateTime}
                onChange={() => onUpdate({ useDateTime: false })}
                className="w-4 h-4 text-orange-600"
              />
              <span className="text-sm text-gray-700">Delay (hours/days)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`schedule-mode-${step.id}`}
                checked={step.useDateTime}
                onChange={() => onUpdate({ useDateTime: true })}
                className="w-4 h-4 text-orange-600"
              />
              <span className="text-sm text-gray-700">Date & Time</span>
            </label>
          </div>
        </div>

        {!step.useDateTime ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delay
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={step.delayMs ? Math.round(step.delayMs / (60 * 60 * 1000)) : 48}
                  onChange={(e) =>
                    onUpdate({
                      delayMs: Math.max(1, parseInt(e.target.value) || 48) * 60 * 60 * 1000,
                    })
                  }
                  className="flex-1 pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Hours"
                />
                <select
                  value={step.delayMs ? Math.round(step.delayMs / (60 * 60 * 1000)) >= 24 ? "days" : "hours" : "hours"}
                  onChange={(e) => {
                    const hours = step.delayMs ? Math.round(step.delayMs / (60 * 60 * 1000)) : 48;
                    if (e.target.value === "days") {
                      onUpdate({ delayMs: hours * 24 * 60 * 60 * 1000 });
                    } else {
                      onUpdate({ delayMs: hours * 60 * 60 * 1000 });
                    }
                  }}
                  className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Date & Time
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="datetime-local"
                value={
                  step.scheduledAt
                    ? new Date(step.scheduledAt).toISOString().slice(0, 16)
                    : (() => {
                        const defaultDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
                        return defaultDate.toISOString().slice(0, 16);
                      })()
                }
                onChange={(e) => {
                  if (e.target.value) {
                    const date = new Date(e.target.value);
                    onUpdate({ scheduledAt: date.toISOString() });
                  }
                }}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Reply Option */}
      <div className="border-t border-gray-300 pt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={step.sendAsReply}
            onChange={(e) => onUpdate({ sendAsReply: e.target.checked })}
            className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
          />
          <div className="flex items-center gap-2">
            {step.sendAsReply ? (
              <Reply className="w-5 h-5 text-orange-600" />
            ) : (
              <Send className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-700">
              Send as Reply (to original email thread)
            </span>
          </div>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-8">
          {step.sendAsReply
            ? "This follow-up will be sent as a reply to the original email, keeping the conversation thread together."
            : "This follow-up will be sent as a separate new email."}
        </p>
      </div>

      {/* Add Nested Follow-up Button */}
      {!step.isNested && (
        <div>
          <button
            type="button"
            onClick={onAddNested}
            className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition-all border-2 border-blue-200 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add nested follow-up
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Add a follow-up that will be sent after this one in the same sequence
          </p>
        </div>
      )}
    </div>
  );
}

