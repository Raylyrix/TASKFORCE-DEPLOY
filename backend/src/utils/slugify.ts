const DEFAULT_SEPARATOR = "-";

const sanitize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, DEFAULT_SEPARATOR)
    .replace(new RegExp(`${DEFAULT_SEPARATOR}+`, "g"), DEFAULT_SEPARATOR)
    .replace(new RegExp(`^${DEFAULT_SEPARATOR}|${DEFAULT_SEPARATOR}$`, "g"), "");

export const slugify = (value: string, fallback = "item") => {
  const sanitized = sanitize(value);
  return sanitized.length > 0 ? sanitized : sanitize(fallback);
};


