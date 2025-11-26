import { createPortal } from "react-dom";

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
  if (typeof document === "undefined") {
    return null;
  }

  if (!visible || !anchorRect) {
    return null;
  }

  const portalTarget = ensurePortalContainer();
  const hasSuggestions = suggestions.length > 0;
  const top = anchorRect.bottom + window.scrollY + 4;
  const left = anchorRect.left + window.scrollX;
  const width = anchorRect.width;

  const content = (
    <div
      style={{
        position: "absolute",
        top,
        left,
        minWidth: Math.max(width, 220),
        maxWidth: 320,
        background: "#ffffff",
        border: "1px solid rgba(60,64,67,0.18)",
        borderRadius: "10px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        zIndex: 2147483647,
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
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                border: "none",
                background: isActive ? "#e8f0fe" : "#ffffff",
                color: "#1f1f1f",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 500 }}>{suggestion}</span>
              <span style={{ fontSize: "11px", color: "#5f6368" }}>Press Enter</span>
            </button>
          );
        })
      ) : (
        <div
          style={{
            padding: "12px 16px",
            fontSize: "12px",
            color: "#5f6368",
          }}
        >
          {emptyState}
        </div>
      )}
    </div>
  );

  return createPortal(content, portalTarget);
};


