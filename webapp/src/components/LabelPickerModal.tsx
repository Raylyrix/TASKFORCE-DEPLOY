"use client";

import React from "react";
import { X } from "lucide-react";

interface Label {
  id: string;
  name: string;
  type?: "system" | "user";
  color?: string | null;
}

interface LabelPickerModalProps {
  labels: Label[];
  currentLabelIds: string[];
  onClose: () => void;
  onApply: (labelIds: string[]) => void;
}

export function LabelPickerModal({ labels, currentLabelIds, onClose, onApply }: LabelPickerModalProps) {
  const [selectedLabels, setSelectedLabels] = React.useState<string[]>(currentLabelIds);

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Select Labels</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {labels.map((label) => (
              <label
                key={label.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLabels.includes(label.id)}
                  onChange={() => toggleLabel(label.id)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: label.color || "#e5e7eb" }}
                />
                <span className="flex-1 text-gray-900">{label.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(selectedLabels)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

