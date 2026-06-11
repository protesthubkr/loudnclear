import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/ops/:path*"],
};

export function proxy(request: NextRequest) {
  const expectedUser = process.env.OPS_BASIC_USER;
  const expectedPassword = process.env.OPS_BASIC_PASSWORD;
  const expectedSecret = process.env.OPS_SECRET_KEY;

  if (isUrlSecretAuthorized(request, expectedSecret)) {
    return NextResponse.next();
  }

  if (!expectedSecret && (!expectedUser || !expectedPassword)) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    return unauthorized("Ops credentials are not configured.");
  }

  if (expectedUser && expectedPassword) {
    const credentials = decodeBasicCredentials(
      request.headers.get("authorization"),
    );

    if (
      credentials?.username === expectedUser &&
      credentials.password === expectedPassword
    ) {
      return NextResponse.next();
    }
  }

  return unauthorized("Unauthorized.");
}

function isUrlSecretAuthorized(
  request: NextRequest,
  expectedSecret: string | undefined,
) {
  const actualSecret =
    request.nextUrl.searchParams.get("key") ??
    request.nextUrl.searchParams.get("secret");

  if (!expectedSecret || !actualSecret) {
    return false;
  }

  return areSecretsEqual(actualSecret, expectedSecret);
}

function decodeBasicCredentials(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = globalThis.atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      password: decoded.slice(separatorIndex + 1),
      username: decoded.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

function areSecretsEqual(actual: string, expected: string) {
  const maxLength = Math.max(actual.length, expected.length);
  let mismatch = actual.length ^ expected.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |=
      (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function unauthorized(message: string) {
  return new NextResponse(message, {
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Seongmyeongmoong Ops", charset="UTF-8"',
    },
    status: 401,
  });
}
