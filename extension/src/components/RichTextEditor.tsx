import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";

import { MergeFieldAutocomplete } from "./MergeFieldAutocomplete";

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Roboto", value: "Roboto, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Courier New", value: '"Courier New", monospace' },
];

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Huge", value: "6" },
];

const BLOCK_FORMATS = [
  { label: "Paragraph", value: "p" },
  { label: "Heading 1", value: "h1" },
  { label: "Heading 2", value: "h2" },
  { label: "Heading 3", value: "h3" },
  { label: "Quote", value: "blockquote" },
];

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  mergeFields: string[];
  placeholder?: string;
  autocompleteEnabled?: boolean;
};

export type RichTextEditorHandle = {
  insertMergeField: (token: string) => void;
  focus: () => void;
};

const MERGE_FIELD_REGEX = /{{\s*([\w.-]+)\s*}}/g;
const MERGE_FIELD_SPAN_REGEX = /<span[^>]*data-merge-field="([^"]+)"[^>]*>\s*{{[^}]+}}\s*<\/span>/g;

const HIGHLIGHT_STYLE =
  "background-color:#e8f0fe;color:#174ea6;padding:0 2px;border-radius:4px;white-space:nowrap;font-weight:600;";

const stripMergeFieldSpans = (html: string) =>
  html.replace(MERGE_FIELD_SPAN_REGEX, (_, token: string) => `{{${token}}}`);

const decorateMergeFields = (html: string) =>
  (html || "").replace(MERGE_FIELD_REGEX, (_, token: string) => {
    const cleanToken = token.trim();
    return `<span data-merge-field="${cleanToken}" style="${HIGHLIGHT_STYLE}">{{${cleanToken}}}</span>`;
  });

const applyStyleWithCss = () => {
  try {
    // execCommand signature varies by browser - third param can be boolean or string
    (document.execCommand as (commandId: string, showUI: boolean, value?: any) => boolean)(
      "styleWithCSS",
      false,
      true,
    );
  } catch {
    // ignored
  }
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, mergeFields, placeholder, autocompleteEnabled = true }, ref) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [font, setFont] = useState<string>("");
    const [fontSize, setFontSize] = useState<string>("3");
    const [blockFormat, setBlockFormat] = useState<string>("p");
    const tokenContextRef = useRef<{
      node: Text;
      tokenStart: number;
      caretOffset: number;
    } | null>(null);
    const [autocompleteState, setAutocompleteState] = useState<{
      open: boolean;
      anchorRect: DOMRect | null;
      filtered: string[];
      selectedIndex: number;
    }>({
      open: false,
      anchorRect: null,
      filtered: [],
      selectedIndex: 0,
    });

    const closeAutocomplete = () => {
      tokenContextRef.current = null;
      setAutocompleteState((state) => ({ ...state, open: false }));
    };

    const getTokenContext = () => {
      if (!editorRef.current || mergeFields.length === 0) {
        return null;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      const anchorNode = selection.anchorNode;
      if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return null;
      if (!editorRef.current.contains(anchorNode)) return null;

      const textNode = anchorNode as Text;
      const caretOffset = selection.anchorOffset;
      const textContent = textNode.textContent ?? "";
      const prefix = textContent.slice(0, caretOffset);
      const match = prefix.match(/{{([\w.-]*)$/);

      if (!match) {
        return null;
      }

      const token = match[1] ?? "";
      const tokenStart = caretOffset - token.length - 2;
      if (tokenStart < 0) {
        return null;
      }

      const range = document.createRange();
      range.setStart(textNode, tokenStart);
      range.setEnd(textNode, caretOffset);
      const rects = range.getClientRects();
      const anchorRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
      const maybeRange = range as unknown as { detach?: () => void };
      if (typeof maybeRange.detach === "function") {
        maybeRange.detach();
      }

      return { textNode, token, tokenStart, caretOffset, anchorRect };
    };

    useImperativeHandle(
      ref,
      () => ({
        insertMergeField: (token: string) => {
          if (!editorRef.current) return;
          editorRef.current.focus();
          applyStyleWithCss();
          const html = `<span data-merge-field="${token}" style="${HIGHLIGHT_STYLE}">{{${token}}}</span>`;
          document.execCommand("insertHTML", false, html);
          emitChange();
        },
        focus: () => {
          editorRef.current?.focus();
        },
      }),
      [onChange, value],
    );

    const emitChange = () => {
      if (!editorRef.current) return;
      const rawHtml = editorRef.current.innerHTML;
      const plain = stripMergeFieldSpans(rawHtml);
      if (plain !== value) {
        onChange(plain);
      }
    };

    const updateAutocomplete = () => {
      if (!autocompleteEnabled || mergeFields.length === 0) {
        closeAutocomplete();
        return;
      }
      const context = getTokenContext();
      if (!context) {
        closeAutocomplete();
        return;
      }

      tokenContextRef.current = {
        node: context.textNode,
        tokenStart: context.tokenStart,
        caretOffset: context.caretOffset,
      };

      const filtered =
        context.token.length === 0
          ? mergeFields
          : mergeFields.filter((field) =>
              field.toLowerCase().includes(context.token.toLowerCase()),
            );

      setAutocompleteState({
        open: true,
        anchorRect: context.anchorRect,
        filtered,
        selectedIndex: 0,
      });
    };

    const applyAutocompleteSuggestion = (field: string) => {
      if (!editorRef.current) return;
      const context = tokenContextRef.current;
      if (!context) {
        closeAutocomplete();
        return;
      }

      const { node, tokenStart, caretOffset } = context;
      const textContent = node.textContent ?? "";
      const before = textContent.slice(0, tokenStart);
      const after = textContent.slice(caretOffset);
      node.textContent = `${before}${after}`;

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        const newOffset = before.length;
        range.setStart(node, newOffset);
        range.setEnd(node, newOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      closeAutocomplete();
      editorRef.current.focus();
      applyStyleWithCss();
      const html = `<span data-merge-field="${field}" style="${HIGHLIGHT_STYLE}">{{${field}}}</span>`;
      document.execCommand("insertHTML", false, html);
      emitChange();
      requestAnimationFrame(() => {
        updateAutocomplete();
      });
    };

    const handleAutocompleteHover = (index: number) => {
      setAutocompleteState((state) => ({ ...state, selectedIndex: index }));
    };

    const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (!autocompleteEnabled) {
        if (event.key === "Escape") {
          closeAutocomplete();
        }
        return;
      }

      if (!autocompleteState.open) {
        if (
          event.key === "{" ||
          event.key === "Backspace" ||
          event.key === "Delete" ||
          event.key.length === 1
        ) {
          requestAnimationFrame(updateAutocomplete);
        } else if (event.key === "Escape") {
          closeAutocomplete();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          setAutocompleteState((state) => {
            if (state.filtered.length === 0) return state;
            const nextIndex = (state.selectedIndex + 1) % state.filtered.length;
            return { ...state, selectedIndex: nextIndex };
          });
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          setAutocompleteState((state) => {
            if (state.filtered.length === 0) return state;
            const nextIndex =
              (state.selectedIndex - 1 + state.filtered.length) % state.filtered.length;
            return { ...state, selectedIndex: nextIndex };
          });
          break;
        }
        case "Enter":
        case "Tab": {
          if (autocompleteState.filtered.length > 0) {
            event.preventDefault();
            const choice =
              autocompleteState.filtered[autocompleteState.selectedIndex] ??
              autocompleteState.filtered[0];
            applyAutocompleteSuggestion(choice);
          } else {
            closeAutocomplete();
          }
          break;
        }
        case "Escape": {
          event.preventDefault();
          closeAutocomplete();
          break;
        }
        default: {
          requestAnimationFrame(updateAutocomplete);
          break;
        }
      }
    };

    const handleInput = () => {
      emitChange();
      requestAnimationFrame(updateAutocomplete);
    };

    const handleBlur = () => {
      emitChange();
      closeAutocomplete();
    };

    const handlePaste = () => {
      requestAnimationFrame(() => {
        emitChange();
        updateAutocomplete();
      });
    };

    const applyCommand = (command: string, commandValue?: string) => {
      applyStyleWithCss();
      document.execCommand(command, false, commandValue ?? "");
      emitChange();
    };

    const toggleLink = () => {
      const url = window.prompt("Enter link URL");
      if (!url) return;
      applyCommand("createLink", url);
    };

    const handleMergeFieldSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const token = event.target.value;
      if (!token) return;
      event.currentTarget.selectedIndex = 0;
      if (!editorRef.current) return;
      editorRef.current.focus();
      applyStyleWithCss();
      const html = `<span data-merge-field="${token}" style="${HIGHLIGHT_STYLE}">{{${token}}}</span>`;
      document.execCommand("insertHTML", false, html);
      emitChange();
      closeAutocomplete();
    };

    const isEmpty = !value || value.replace(/<[^>]+>/g, "").trim().length === 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            border: "1px solid #dadce0",
            borderRadius: "12px",
            padding: "10px",
            backgroundColor: "#f8f9fa",
          }}
        >
          <select
            value={font}
            onChange={(event) => {
              const selected = event.target.value;
              setFont(selected);
              if (selected) {
                applyCommand("fontName", selected);
              }
            }}
            style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #dadce0", fontSize: "12px" }}
          >
            {FONT_FAMILIES.map(({ label, value: optionValue }) => (
              <option key={label} value={optionValue}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={fontSize}
            onChange={(event) => {
              const selected = event.target.value;
              setFontSize(selected);
              applyCommand("fontSize", selected);
            }}
            style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #dadce0", fontSize: "12px" }}
          >
            {FONT_SIZES.map(({ label, value: optionValue }) => (
              <option key={label} value={optionValue}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={blockFormat}
            onChange={(event) => {
              const selected = event.target.value;
              setBlockFormat(selected);
              applyCommand("formatBlock", selected === "p" ? "div" : selected);
            }}
            style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #dadce0", fontSize: "12px" }}
          >
            {BLOCK_FORMATS.map(({ label, value: optionValue }) => (
              <option key={label} value={optionValue}>
                {label}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <ToolbarButton label="B" onClick={() => applyCommand("bold")} title="Bold (Ctrl+B)" />
            <ToolbarButton label="I" onClick={() => applyCommand("italic")} title="Italic (Ctrl+I)" />
            <ToolbarButton label="U" onClick={() => applyCommand("underline")} title="Underline (Ctrl+U)" />
            <ToolbarButton label="S" onClick={() => applyCommand("strikeThrough")} title="Strikethrough" />
            <ToolbarButton label="A" onClick={() => applyCommand("justifyLeft")} title="Align left" />
            <ToolbarButton label="C" onClick={() => applyCommand("justifyCenter")} title="Align center" />
            <ToolbarButton label="R" onClick={() => applyCommand("justifyRight")} title="Align right" />
            <ToolbarButton label="•" onClick={() => applyCommand("insertUnorderedList")} title="Bulleted list" />
            <ToolbarButton label="1." onClick={() => applyCommand("insertOrderedList")} title="Numbered list" />
            <ToolbarButton label="⤴" onClick={() => applyCommand("outdent")} title="Decrease indent" />
            <ToolbarButton label="⤵" onClick={() => applyCommand("indent")} title="Increase indent" />
            <ToolbarButton label="Link" onClick={toggleLink} title="Insert link" />
            <ToolbarButton label="Clear" onClick={() => applyCommand("removeFormat")} title="Clear formatting" />
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#5f6368",
            }}
          >
            Text
            <input
              type="color"
              onChange={(event) => applyCommand("foreColor", event.target.value)}
              style={{
                width: "32px",
                height: "22px",
                border: "1px solid #dadce0",
                borderRadius: "6px",
                padding: "0",
                backgroundColor: "transparent",
              }}
            />
          </label>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#5f6368",
            }}
          >
            Highlight
            <input
              type="color"
              onChange={(event) => applyCommand("hiliteColor", event.target.value)}
              style={{
                width: "32px",
                height: "22px",
                border: "1px solid #dadce0",
                borderRadius: "6px",
                padding: "0",
                backgroundColor: "transparent",
              }}
            />
          </label>

          <select
            defaultValue=""
            onChange={handleMergeFieldSelect}
            style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #dadce0", fontSize: "12px" }}
          >
            <option value="">Insert merge field</option>
            {mergeFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div style={{ position: "relative" }}>
          <div
            ref={editorRef}
            contentEditable
            spellCheck
            dir="ltr"
            onInput={handleInput}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onKeyDown={handleEditorKeyDown}
            onFocus={() => requestAnimationFrame(updateAutocomplete)}
            onClick={() => requestAnimationFrame(updateAutocomplete)}
            style={{
              minHeight: "260px",
              padding: "16px",
              borderRadius: "14px",
              border: "1px solid #dadce0",
              backgroundColor: "#ffffff",
              fontSize: "14px",
              lineHeight: 1.6,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
            }}
            suppressContentEditableWarning
          />

          {isEmpty && placeholder ? (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                pointerEvents: "none",
                color: "#9aa0a6",
                fontSize: "14px",
              }}
            >
              {placeholder}
            </div>
          ) : null}
          <MergeFieldAutocomplete
            anchorRect={autocompleteState.anchorRect}
            suggestions={autocompleteState.filtered}
            highlightedIndex={autocompleteState.selectedIndex}
            visible={autocompleteState.open && autocompleteEnabled}
            onSelect={applyAutocompleteSuggestion}
            onHover={handleAutocompleteHover}
          />
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = "RichTextEditor";

const ToolbarButton = ({ label, onClick, title }: { label: string; onClick: () => void; title?: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      padding: "6px 10px",
      borderRadius: "8px",
      border: "1px solid #dadce0",
      backgroundColor: "#ffffff",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: 600,
    }}
  >
    {label}
  </button>
);
