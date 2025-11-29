"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type MergeFieldAutocompleteProps = {
  anchorRect: DOMRect | null;
  suggestions: string[];
  highlightedIndex: number;
  visible: boolean;
  onSelect: (field: string) => void;
  onHover?: (index: number) => void;
  emptyState?: string;
};

const AUTOCOMPLETE_PORTAL_ID = "taskforce-merge-field-autocomplete";

const ensurePortalContainer = () => {
  if (typeof document === "undefined") return null;
  let container = document.getElementById(AUTOCOMPLETE_PORTAL_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = AUTOCOMPLETE_PORTAL_ID;
    document.body.appendChild(container);
  }
  return container;
};

export const MergeFieldAutocomplete = ({
  anchorRect,
  suggestions,
  highlightedIndex,
  visible,
  onSelect,
  onHover,
  emptyState = "No matching merge fields",
}: MergeFieldAutocompleteProps) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (visible && anchorRect) {
      const portalTarget = ensurePortalContainer();
      setContainer(portalTarget);
    } else {
      setContainer(null);
    }
  }, [visible, anchorRect]);

  if (typeof document === "undefined" || !visible || !anchorRect || !container) {
    return null;
  }

  const hasSuggestions = suggestions.length > 0;
  const top = anchorRect.bottom + 4;
  const left = anchorRect.left;
  const width = anchorRect.width;

  const content = (
    <div
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        minWidth: Math.max(width, 220),
        maxWidth: 320,
        background: "#ffffff",
        border: "1px solid rgba(60,64,67,0.18)",
        borderRadius: "10px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        zIndex: 99999,
        overflow: "hidden",
        fontFamily: "Roboto, Arial, sans-serif",
      }}
      role="listbox"
      aria-label="Merge field suggestions"
    >
      {hasSuggestions ? (
        suggestions.map((suggestion, index) => {
          const isActive = index === highlightedIndex;
          return (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHover?.(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(suggestion);
              }}
              className={`w-full flex justify-between items-center px-3.5 py-2.5 border-none text-sm cursor-pointer transition-colors ${
                isActive ? "bg-blue-50 text-gray-900" : "bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span className="font-medium">{suggestion}</span>
              <span className="text-xs text-gray-500">Press Enter</span>
            </button>
          );
        })
      ) : (
        <div className="px-4 py-3 text-xs text-gray-500">
          {emptyState}
        </div>
      )}
    </div>
  );

  return createPortal(content, container);
};

