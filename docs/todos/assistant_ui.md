# Assistant UI Notes

This note captures the current `assistant_ui` chat request flow and the concrete argument behavior for the Command Center base-session call.

## `get_or_create_astro_command_center` request

Endpoint:
- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

Function:
- `fetchOrCreateCommandCenterBaseSession({ currentSessionId?, signal?, token?, tokenType = "Bearer" })`

Headers sent:
- `Accept: application/json`
- `Authorization: <tokenType> <token>` when token exists

Body fields:
- `current_session` (optional): included only when `currentSessionId` is provided and non-empty after normalization.
- `create_knative_service` (optional): included only when proxy mode is **disabled**.

How `create_knative_service` is resolved:
- `shouldSkipKnativeServiceCreation = Boolean(VITE_ASSISTANT_UI_PROXY_TARGET?.trim())`
- `create_knative_service = !shouldSkipKnativeServiceCreation`

With your current `.env` (`VITE_ASSISTANT_UI_PROXY_TARGET=http://192.168.1.253:8787`), `create_knative_service` is sent as `false`.

## Related paths

- Chat bootstrap path in provider: `ChatProvider` calls base-session APIs when the chat page/rail is hydrated.
- Model/session catalog and history requests are requested separately under `/api/chat/*`.

## TODOs

- [ ] Block chat UI interactions until the base session is established to avoid early submissions before session hydration and improve UX.
- [ ] Wait for session insights endpoint availability/readiness from the backend pod before continuing chat flow, since `/sessions/{id}/insights/` can return 404 while pod startup is incomplete.

## Observed startup logs

```
tsorm_web_local  | 2026-04-27T10:32:20.833467Z [info     ] HTTP GET /orm/api/agents/v1/sessions/63/ 200 [7.25, 172.217.171.170:48898] [django.channels.server] client_ip_port=172.217.171.170:48898 duration_ms=7250 duration_s=7.25 filename=runserver.py func_name=log_action http_method=GET http_path=/orm/api/agents/v1/sessions/63/ lineno=181 module=runserver pathname=/usr/local/lib/python3.9/site-packages/daphne/management/commands/runserver.py request_id=None status_code=200
tsorm_web_local  | /usr/local/lib/python3.9/site-packages/daphne/management/commands/runserver.py:181
tsorm_web_local  | 2026-04-27T10:32:25.147399Z [warning  ] HTTP GET /orm/api/agents/v1/sessions/63/insights/ 404 [4.29, 172.217.171.170:48898] [django.channels.server] client_ip_port=172.217.171.170:48898 duration_ms=4290 duration_s=4.29 filename=runserver.py func_name=log_action http_method=GET http_path=/orm/api/agents/v1/sessions/63/insights/ lineno=189 module=runserver pathname=/usr/local/lib/python3.9/site-packages/daphne/management/commands/runserver.py request_id=None status_code=404
tsorm_web_local  | /usr/local/lib/python3.9/site-packages/daphne/management/commands/runserver.py:189
```
