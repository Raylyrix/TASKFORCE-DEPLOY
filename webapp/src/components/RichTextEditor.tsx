"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Type,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
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

    const insertImage = () => {
      const url = window.prompt("Enter image URL");
      if (!url) return;
      applyCommand("insertImage", url);
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

    // Initialize editor content on mount
    useEffect(() => {
      if (editorRef.current) {
        const decorated = decorateMergeFields(value || "");
        if (editorRef.current.innerHTML !== decorated) {
          editorRef.current.innerHTML = decorated || "";
        }
      }
    }, []);

    // Sync value prop with editor content (only when value changes externally)
    const isUserEditingRef = useRef(false);
    const lastValueRef = useRef(value);
    
    useEffect(() => {
      if (!editorRef.current) return;
      // Skip if user is currently editing
      if (isUserEditingRef.current) {
        isUserEditingRef.current = false;
        lastValueRef.current = value;
        return;
      }
      // Only update if value changed externally (not from user input)
      if (lastValueRef.current !== value) {
        const decoratedValue = decorateMergeFields(value || "");
        editorRef.current.innerHTML = decoratedValue || "";
        lastValueRef.current = value;
      }
    }, [value]);
    
    const handleInput = () => {
      isUserEditingRef.current = true;
      emitChange();
      requestAnimationFrame(updateAutocomplete);
    };

    const isEmpty = !value || value.replace(/<[^>]+>/g, "").trim().length === 0;

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center border border-gray-300 rounded-xl p-3 bg-gray-50">
          <select
            value={font}
            onChange={(event) => {
              const selected = event.target.value;
              setFont(selected);
              if (selected) {
                applyCommand("fontName", selected);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900"
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
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900"
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
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900"
          >
            {BLOCK_FORMATS.map(({ label, value: optionValue }) => (
              <option key={label} value={optionValue}>
                {label}
              </option>
            ))}
          </select>

          <div className="flex gap-1 flex-wrap">
            <ToolbarButton icon={<Bold className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("bold")} title="Bold (Ctrl+B)" />
            <ToolbarButton icon={<Italic className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("italic")} title="Italic (Ctrl+I)" />
            <ToolbarButton icon={<Underline className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("underline")} title="Underline (Ctrl+U)" />
            <ToolbarButton icon={<Strikethrough className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("strikeThrough")} title="Strikethrough" />
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <ToolbarButton icon={<AlignLeft className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("justifyLeft")} title="Align left" />
            <ToolbarButton icon={<AlignCenter className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("justifyCenter")} title="Align center" />
            <ToolbarButton icon={<AlignRight className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("justifyRight")} title="Align right" />
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <ToolbarButton icon={<List className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("insertUnorderedList")} title="Bulleted list" />
            <ToolbarButton icon={<ListOrdered className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("insertOrderedList")} title="Numbered list" />
            <ToolbarButton icon={<LinkIcon className="w-4 h-4 text-gray-900" />} onClick={toggleLink} title="Insert link" />
            <ToolbarButton icon={<ImageIcon className="w-4 h-4 text-gray-900" />} onClick={insertImage} title="Insert image (URL)" />
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <ToolbarButton icon={<Type className="w-4 h-4 text-gray-900" />} onClick={() => applyCommand("removeFormat")} title="Clear formatting" />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <Palette className="w-4 h-4 text-gray-600" />
            Text
            <input
              type="color"
              onChange={(event) => applyCommand("foreColor", event.target.value)}
              className="w-8 h-7 border border-gray-300 rounded cursor-pointer"
            />
          </label>

          {mergeFields.length > 0 && (
            <select
              defaultValue=""
              onChange={handleMergeFieldSelect}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900"
          >
            <option value="">Insert merge field</option>
            {mergeFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
          )}
        </div>

        <div className="relative">
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
            className="min-h-[280px] p-4 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 leading-relaxed overflow-y-auto focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            style={{ color: '#111827' }}
            suppressContentEditableWarning
          />

          {isEmpty && placeholder && (
            <div className="absolute top-4 left-4 pointer-events-none text-gray-400 text-sm">
              {placeholder}
            </div>
          )}
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

const ToolbarButton = ({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title?: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
  >
    {icon}
  </button>
);

