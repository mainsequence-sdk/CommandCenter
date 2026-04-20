import {
  buildMainSequenceAiAssistantUrl,
  fetchMainSequenceAiAssistantResponse,
} from "./assistant-endpoint";

export interface AssistantHealthSnapshot {
  body: unknown;
  bodyText: string;
  contentType: string;
  ok: boolean;
  status: number;
  statusText: string;
  capturedAt: string;
  url: string;
}

async function readHealthBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();

  if (contentType.includes("application/json") && rawText.trim()) {
    try {
      const json = JSON.parse(rawText) as unknown;
      return {
        body: json,
        bodyText: JSON.stringify(json, null, 2),
        contentType,
      };
    } catch {
      // Fall through to raw text if a backend returns invalid JSON with a JSON content type.
    }
  }

  return {
    body: rawText,
    bodyText: rawText,
    contentType,
  };
}

export async function fetchAssistantHealth({
  assistantEndpoint,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}): Promise<AssistantHealthSnapshot> {
  let url = buildMainSequenceAiAssistantUrl(assistantEndpoint, "/health");
  let response: Response;

  try {
    ({ response, url } = await fetchMainSequenceAiAssistantResponse({
      accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      assistantEndpoint,
      requestPath: "/health",
      method: "GET",
      signal,
      sessionToken: token,
      sessionTokenType: tokenType,
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown fetch error.";
    throw new Error(`Failed to fetch health endpoint ${url}. ${detail}`);
  }

  const body = await readHealthBody(response);

  return {
    ...body,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    capturedAt: new Date().toISOString(),
    url,
  };
}
