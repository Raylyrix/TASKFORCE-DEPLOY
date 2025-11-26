"use client";

import React from "react";
import { X, Plus, Trash2 } from "lucide-react";

interface Label {
  id: string;
  name: string;
  type?: "system" | "user";
  color?: string | null;
}

interface LabelManagerModalProps {
  labels: Label[];
  onClose: () => void;
}

export function LabelManagerModal({ labels, onClose }: LabelManagerModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Manage Labels</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: label.color || "#e5e7eb" }}
                  />
                  <span className="text-gray-900">{label.name}</span>
                  {label.type === "system" && (
                    <span className="text-xs text-gray-500">(System)</span>
                  )}
                </div>
                {label.type === "user" && (
                  <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

