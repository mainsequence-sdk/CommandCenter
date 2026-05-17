import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ConnectionQueryEditorSection,
  ConnectionQueryField,
} from "@/connections/components/ConnectionQueryEditorFields";
import type { ConnectionQueryEditorProps } from "@/connections/types";

import {
  DEFAULT_MOCK_API_RESPONSE_BODY,
  MOCK_API_QUERY_KIND,
  type MockApiConnectionQuery,
  type MockApiPublicConfig,
  type MockApiResponseMode,
} from "./mock-api-contract";

const responseModeOptions: Array<{ value: MockApiResponseMode; label: string }> = [
  { value: "auto", label: "Auto detect" },
  { value: "rows", label: "Rows JSON" },
  { value: "tabular-frame", label: "Command Center frame" },
  { value: "connection-query-response", label: "Connection query response" },
];

function formatJson(value: unknown) {
  return JSON.stringify(value ?? DEFAULT_MOCK_API_RESPONSE_BODY, null, 2);
}

function readPublicConfig(value: unknown): MockApiPublicConfig {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MockApiPublicConfig)
    : {};
}

function patchQuery(
  value: MockApiConnectionQuery,
  onChange: (value: MockApiConnectionQuery) => void,
  patch: Partial<MockApiConnectionQuery>,
) {
  onChange({
    ...value,
    ...patch,
    kind: MOCK_API_QUERY_KIND,
  });
}

export function MockApiConnectionQueryEditor({
  connectionInstance,
  disabled = false,
  onChange,
  value,
}: ConnectionQueryEditorProps<MockApiConnectionQuery>) {
  const publicConfig = readPublicConfig(connectionInstance?.publicConfig);
  const responseBody = value.responseBody === undefined
    ? publicConfig.defaultResponseBody ?? DEFAULT_MOCK_API_RESPONSE_BODY
    : value.responseBody;
  const serializedResponseBody = useMemo(() => formatJson(responseBody), [responseBody]);
  const [responseText, setResponseText] = useState(serializedResponseBody);
  const [responseError, setResponseError] = useState<string | null>(null);

  useEffect(() => {
    setResponseText(serializedResponseBody);
    setResponseError(null);
  }, [serializedResponseBody]);

  function commitResponseText(nextText = responseText) {
    try {
      const parsed = JSON.parse(nextText) as unknown;
      setResponseError(null);
      patchQuery(value, onChange, { responseBody: parsed });
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : "Response JSON is invalid.");
    }
  }

  return (
    <ConnectionQueryEditorSection
      title="Mock response"
      description="Define the JSON returned by this local mock connection. The normal connection query widget consumes the generated frame, but no backend data source or registry sync is used."
    >
      <ConnectionQueryField
        label="Response mode"
        help="Auto detect accepts a full ConnectionQueryResponse, a Command Center frame, a canonical tabular frame source, an array of row objects, a single object, or a primitive JSON value."
      >
        <Select
          value={value.responseMode ?? publicConfig.defaultResponseMode ?? "auto"}
          disabled={disabled}
          onChange={(event) => {
            patchQuery(value, onChange, {
              responseMode: event.target.value as MockApiResponseMode,
            });
          }}
        >
          {responseModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ConnectionQueryField>

      <ConnectionQueryField
        label="Response status"
        help="HTTP status to simulate. 2xx statuses return the configured response. Non-2xx statuses throw a mock query error."
      >
        <Input
          type="number"
          min={100}
          max={599}
          value={value.responseStatus ?? publicConfig.defaultResponseStatus ?? 200}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            patchQuery(value, onChange, {
              responseStatus: Number.isFinite(parsed) ? Math.trunc(parsed) : undefined,
            });
          }}
        />
      </ConnectionQueryField>

      <ConnectionQueryField
        label="Latency ms"
        help="Optional local delay before the mock response resolves. Values are clamped by the mock executor."
      >
        <Input
          type="number"
          min={0}
          value={value.latencyMs ?? publicConfig.latencyMs ?? 0}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            patchQuery(value, onChange, {
              latencyMs: Number.isFinite(parsed) ? Math.trunc(parsed) : undefined,
            });
          }}
        />
      </ConnectionQueryField>

      <ConnectionQueryField
        className="md:col-span-2"
        label="Response JSON"
        help="JSON body to feed into Mock API. Arrays become table rows, objects become one row, canonical tabular frames are normalized, and full ConnectionQueryResponse objects pass through."
      >
        <Textarea
          className="min-h-72 font-mono text-xs"
          value={responseText}
          disabled={disabled}
          spellCheck={false}
          onChange={(event) => setResponseText(event.target.value)}
          onBlur={() => commitResponseText()}
        />
        {responseError ? (
          <span className="block text-xs text-destructive">{responseError}</span>
        ) : null}
      </ConnectionQueryField>
    </ConnectionQueryEditorSection>
  );
}
