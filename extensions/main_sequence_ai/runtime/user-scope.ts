function normalizeUserUid(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function appendCreatedByUserUidSearchParam(
  requestPath: string,
  createdByUserUid: string | number | null | undefined,
) {
  const normalizedUserUid = normalizeUserUid(createdByUserUid);

  if (!normalizedUserUid) {
    return requestPath;
  }

  const requestUrl = new URL(requestPath, "http://assistant.local");
  requestUrl.searchParams.delete("created_by_user");
  requestUrl.searchParams.set("created_by_user_uid", normalizedUserUid);

  return `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`;
}
