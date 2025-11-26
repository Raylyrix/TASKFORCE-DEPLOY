import pino from "pino";
import pinoPretty from "pino-pretty";

const isDev = process.env.NODE_ENV !== "production";

const stream = isDev
  ? pinoPretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: undefined,
  },
  stream,
);

