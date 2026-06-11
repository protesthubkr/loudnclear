import "server-only";

import type { XUserResponse } from "./types";
import { USER_FIELDS, X_API_BASE_URL } from "./x-api-fields";
import { fetchX } from "./x-api-client";

export async function fetchXUserByUsername({
  bearerToken,
  username,
}: {
  bearerToken: string;
  username: string;
}) {
  const url = new URL(
    `${X_API_BASE_URL}/users/by/username/${encodeURIComponent(username)}`,
  );
  url.searchParams.set("user.fields", USER_FIELDS);

  return fetchX<XUserResponse>(url, bearerToken);
}
