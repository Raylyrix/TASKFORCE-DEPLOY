export const getStringParam = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

export const requireStringParam = (value: unknown, fallback: string = ""): string => {
  return getStringParam(value) ?? fallback;
};

