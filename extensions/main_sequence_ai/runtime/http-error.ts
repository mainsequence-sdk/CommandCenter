function normalizeErrorField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractRuntimeErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    normalizeErrorField(candidate.message) ??
    normalizeErrorField(candidate.detail) ??
    normalizeErrorField(candidate.error) ??
    normalizeErrorField(candidate.error_detail)
  );
}

export function formatRuntimeHttpStatus(response: Response) {
  return response.statusText
    ? `HTTP ${response.status} ${response.statusText}`
    : `HTTP ${response.status}`;
}

export async function readRuntimeBackendErrorMessage(
  response: Response,
  fallbackMessage: string,
) {
  const responseClone = response.clone();
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await responseClone.json().catch(() => null)) as unknown;
    return extractRuntimeErrorMessage(payload) ?? fallbackMessage;
  }

  const rawText = await responseClone.text().catch(() => "");
  if (rawText.trim()) {
    try {
      const payload = JSON.parse(rawText) as unknown;
      return extractRuntimeErrorMessage(payload) ?? rawText.trim();
    } catch {
      return rawText.trim();
    }
  }

  return fallbackMessage;
}

export async function buildRuntimeHttpErrorMessage({
  fallbackMessage,
  method,
  operation,
  response,
  url,
}: {
  fallbackMessage: string;
  method: string;
  operation: string;
  response: Response;
  url: string;
}) {
  const backendMessage = await readRuntimeBackendErrorMessage(
    response,
    fallbackMessage,
  );

  return `${operation}. Status: ${formatRuntimeHttpStatus(response)}. Call: ${method.toUpperCase()} ${url}. Backend response: ${backendMessage}`;
}
