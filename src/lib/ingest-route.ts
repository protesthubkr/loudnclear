import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { isBearerSecretAuthorized } from "@/lib/bearer-auth";

export class ManualRunRequestError extends Error {}

export function isCronRunAuthorized(request: NextRequest) {
  return isBearerSecretAuthorized(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
}

export function isManualRunAuthorized(request: NextRequest) {
  if (!process.env.OPS_RUN_SECRET) {
    return false;
  }

  return isBearerSecretAuthorized(
    request.headers.get("authorization"),
    process.env.OPS_RUN_SECRET,
  );
}

export function hasUrlRunOptions(request: NextRequest) {
  return new URL(request.url).searchParams.toString().length > 0;
}

export function rejectUrlRunOptions() {
  return NextResponse.json(
    { error: "Run options require POST with a JSON body." },
    { status: 400 },
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function methodNotAllowed(allowedMethods: string[]) {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    {
      headers: {
        Allow: allowedMethods.join(", "),
      },
      status: 405,
    },
  );
}

export async function readManualRunSearchParams(request: NextRequest) {
  const text = await request.text();

  if (!text.trim()) {
    throw new ManualRunRequestError("Manual run options require a JSON body.");
  }

  let body: unknown;

  try {
    body = JSON.parse(text);
  } catch {
    throw new ManualRunRequestError("Invalid JSON body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ManualRunRequestError("Invalid JSON body.");
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new ManualRunRequestError("Invalid JSON body.");
    }

    searchParams.set(key, String(value));
  }

  if (searchParams.toString().length === 0) {
    throw new ManualRunRequestError("Manual run options require a JSON body.");
  }

  return searchParams;
}
