import type { TelegramStatementScanState } from "./types";

const DEFAULT_MAX_PAGES_PER_CHANNEL = 3;
const DEFAULT_BACKFILL_MAX_PAGES_PER_CHANNEL = 60;
const DEFAULT_BOOTSTRAP_HOURS = 24;
const DEFAULT_CHANNEL_DELAY_MAX_MS = 1800;
const DEFAULT_CHANNEL_DELAY_MIN_MS = 800;
const DEFAULT_PAGE_DELAY_MAX_MS = 1200;
const DEFAULT_PAGE_DELAY_MIN_MS = 500;
const LOCK_TTL_MINUTES = 9;

type DelayRange = {
  maxMs: number;
  minMs: number;
};

export function isStateLocked(state: TelegramStatementScanState | null) {
  if (!state?.lockedAt) {
    return false;
  }

  const lockedAt = Date.parse(state.lockedAt);

  if (!Number.isFinite(lockedAt)) {
    return false;
  }

  return Date.now() - lockedAt < LOCK_TTL_MINUTES * 60 * 1000;
}

export function getMaxPagesPerChannel({
  backfill,
  optionValue,
}: {
  backfill: boolean;
  optionValue: number | undefined;
}) {
  if (optionValue) {
    return optionValue;
  }

  const value = Number.parseInt(
    process.env.TELEGRAM_STATEMENT_SCAN_MAX_PAGES ?? "",
    10,
  );

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return backfill
    ? DEFAULT_BACKFILL_MAX_PAGES_PER_CHANNEL
    : DEFAULT_MAX_PAGES_PER_CHANNEL;
}

export function getBootstrapHours() {
  const value = Number.parseInt(
    process.env.TELEGRAM_STATEMENT_SCAN_BOOTSTRAP_HOURS ?? "",
    10,
  );

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_BOOTSTRAP_HOURS;
}

export function getWindowHours(optionValue: number | undefined) {
  if (optionValue) {
    return optionValue;
  }

  const value = Number.parseInt(
    process.env.TELEGRAM_STATEMENT_BACKFILL_WINDOW_HOURS ?? "",
    10,
  );

  return Number.isFinite(value) && value > 0 ? value : 48;
}

export async function waitForTelegramStatementChannelDelay() {
  await waitForTelegramStatementDelay(getTelegramStatementChannelDelayRange());
}

export async function waitForTelegramStatementPageDelay() {
  await waitForTelegramStatementDelay(getTelegramStatementPageDelayRange());
}

function getTelegramStatementChannelDelayRange() {
  return getDelayRange({
    defaultMaxMs: DEFAULT_CHANNEL_DELAY_MAX_MS,
    defaultMinMs: DEFAULT_CHANNEL_DELAY_MIN_MS,
    maxEnvKey: "TELEGRAM_STATEMENT_CHANNEL_DELAY_MAX_MS",
    minEnvKey: "TELEGRAM_STATEMENT_CHANNEL_DELAY_MIN_MS",
  });
}

function getTelegramStatementPageDelayRange() {
  return getDelayRange({
    defaultMaxMs: DEFAULT_PAGE_DELAY_MAX_MS,
    defaultMinMs: DEFAULT_PAGE_DELAY_MIN_MS,
    maxEnvKey: "TELEGRAM_STATEMENT_PAGE_DELAY_MAX_MS",
    minEnvKey: "TELEGRAM_STATEMENT_PAGE_DELAY_MIN_MS",
  });
}

function getDelayRange({
  defaultMaxMs,
  defaultMinMs,
  maxEnvKey,
  minEnvKey,
}: {
  defaultMaxMs: number;
  defaultMinMs: number;
  maxEnvKey: string;
  minEnvKey: string;
}): DelayRange {
  const minMs = getNonNegativeIntegerEnv(minEnvKey) ?? defaultMinMs;
  const maxMs = getNonNegativeIntegerEnv(maxEnvKey) ?? defaultMaxMs;

  if (maxMs < minMs) {
    return {
      maxMs: minMs,
      minMs,
    };
  }

  return {
    maxMs,
    minMs,
  };
}

function getNonNegativeIntegerEnv(key: string) {
  const value = Number.parseInt(process.env[key] ?? "", 10);

  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function waitForTelegramStatementDelay(range: DelayRange) {
  const delayMs = getRandomDelayMs(range);

  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getRandomDelayMs({ maxMs, minMs }: DelayRange) {
  if (maxMs <= minMs) {
    return minMs;
  }

  return Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
}
