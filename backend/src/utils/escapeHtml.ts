const HTML_ESCAPE_REGEXP = /[&<>"']/g;
const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (input: string | null | undefined): string => {
  if (!input) return "";
  return input.replace(HTML_ESCAPE_REGEXP, (char) => ESCAPE_MAP[char] ?? char);
};











