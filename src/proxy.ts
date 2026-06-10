import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/ops/:path*"],
};

export function proxy(request: NextRequest) {
  const expectedUser = process.env.OPS_BASIC_USER;
  const expectedPassword = process.env.OPS_BASIC_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    return unauthorized("Ops credentials are not configured.");
  }

  const credentials = decodeBasicCredentials(
    request.headers.get("authorization"),
  );

  if (
    credentials?.username === expectedUser &&
    credentials.password === expectedPassword
  ) {
    return NextResponse.next();
  }

  return unauthorized("Unauthorized.");
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

function unauthorized(message: string) {
  return new NextResponse(message, {
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Seongmyeongmoong Ops", charset="UTF-8"',
    },
    status: 401,
  });
}
