## buildPurpose

OpenAPI-powered request widget for workspaces. Use it to turn one API operation into a reusable form, execute that request from the canvas or workspace refresh graph, and publish response-derived outputs for downstream widget bindings.

## whenToUse

- Use when the service is OpenAPI-described and one selected operation is the unit of work.
- Use when the request should be executable from the workspace refresh/runtime layer.
- Use when a workspace needs a user-facing API form whose request fields are generated from path, query, header, and JSON body metadata.
- Use when request inputs should be filled by upstream widget bindings, local draft values, saved prefills, or defaults, then submitted as one HTTP request.
- Use when a request result should feed downstream widgets through dynamic response ports, a structured response output, editable-form outputs, or scalar leaf outputs inferred from the OpenAPI response schema.
- Use when a Main Sequence FastAPI resource release should be called through the exchange-launch token transport instead of a manual public API URL.
- Use when a real API does not exist yet and the workspace still needs to prototype request forms, response UI, and downstream bindings through the inline Mock JSON target.
- Use when the selected OpenAPI operation advertises supported request or response UI metadata, such as `select2` async-search inputs, notification banners, or editable-form responses.

## whenNotToUse

- Do not use when the request is a static data source better modeled as a Data Node.
- Do not use when the service has no stable OpenAPI discovery path or release target.
- Do not use for multi-step orchestration inside one widget. Model each API operation as its own AppComponent and connect them with workspace bindings.
- Do not use for arbitrary custom frontend logic or JavaScript lifecycle code. AppComponent executes one described HTTP operation and renders generated forms.
- Do not use when downstream widgets need a canonical tabular dataset and the API response still needs extraction, normalization, pagination, or transformation better owned by a Data Node or dedicated adapter.
- Do not use settings-side Test request as a workspace workflow trigger. Test request is isolated to settings; canvas Submit and dashboard refresh are the workspace execution paths.

## authoringSteps

- Choose the target mode. `manual` calls a configured API base URL or OpenAPI URL, `main-sequence-resource-release` calls a selected Main Sequence FastAPI release through exchange-launch tokens, and `mock-json` compiles a saved inline mock operation without network traffic.
- Configure auth and transport. Manual mode can use the current session JWT or no auth. Static service headers apply to manual discovery and execution. Resource-release mode owns its launch-token `Authorization` and `X-FastAPI-ID` headers. Mock JSON ignores network headers.
- Discover the OpenAPI document, choose exactly one operation, choose the request body content type when needed, and save the compiled `bindingSpec`.
- Treat `bindingSpec` as the instance contract. It stores the operation key, generated request form, request input ports, and response output ports used by the workspace binding graph.
- Review request inputs in settings. Generated fields may come from path, query, header, or body schema. Unsupported or complex body schemas fall back to a raw JSON body editor instead of blocking the operation.
- Use the Request input map when the canvas form needs presentation changes. It can hide fields from the card, rename labels, or prefill values without changing stable field keys or binding ports. Hidden fields still submit when they have prefills, defaults, draft values, or bound values.
- Bind upstream outputs to generated request input ports when another widget should provide request values. Bound values override local draft values for that request field at execution time, and the field is marked as bound in the form.
- Configure card behavior. `refreshOnDashboardRefresh` controls whether dashboard refresh reruns the request. `showResponse` controls whether the latest response appears on the card. `hideRequestButton` removes manual Submit so the widget runs only from graph execution, upstream flow execution, or dashboard refresh. `requestButtonLabel` only changes button text.
- Use canvas Submit for live workspace execution. When the dashboard execution coordinator is available, Submit runs the source-driven widget flow: executable upstream dependencies run first so bound request inputs can be fresh, then this AppComponent executes, then downstream executable dependents can rerun from the newly published outputs.
- Use dashboard refresh for repeatable workspace refresh. When `refreshOnDashboardRefresh` is enabled, the request is eligible for refresh execution and republishes outputs. When disabled, the widget is manual-only unless another graph flow explicitly executes it.
- Use settings Test request only to validate the selected target and operation. It sends the request through the selected widget target but does not intentionally fan out through downstream workspace widgets.
- Connect downstream widgets to response outputs after a successful request. Standard responses publish ports compiled from the primary response schema. Editable-form responses publish `editable-form:$` plus one `editable-form:field:<token>` output per field token. Response output values are cleared for failed runs so deeper chains do not continue from stale data.

## blockingRequirements

- A valid target is required: manual URL or OpenAPI URL, Main Sequence resource release, or saved Mock JSON definition.
- A selected method and path are required. The widget maps one instance to one OpenAPI operation.
- A saved `bindingSpec` is required for reliable runtime execution and dynamic IO. Runtime may enrich stale saved forms from live OpenAPI metadata when available, but the saved binding spec remains the binding contract.
- Required request fields must be satisfiable by a bound input, current draft value, saved prefill, schema default/example, or runtime patch. If the request cannot be built, execution fails before the API call.
- Response outputs depend on a successful response. Failed execution clears response-derived outputs for that run and records the error in runtime state.
- Dashboard refresh only runs this widget when `refreshOnDashboardRefresh` is not disabled and the widget is otherwise executable.
- Main Sequence resource-release mode requires a valid release reference and a successful exchange-launch response. Launch tokens are kept in memory and refreshed/retried as needed; they are not persisted in widget props.
- Mock JSON mode requires a serializable mock definition with operation, request metadata, and response fixture. It is the only target mode that does not make network requests.

## commonPitfalls

- Changing the target or operation without recompiling the binding spec leaves the runtime contract stale.
- Request-side and response-side UI metadata only apply when the selected OpenAPI operation or primary response schema advertises a supported UI contract.
- Manual Submit is not just a local button click when the widget is mounted in a workspace. It can execute upstream dependencies first and downstream dependents afterward through the dashboard graph runner. This is intentional so chained AppComponents can behave like `A -> B -> C`.
- Settings Test request is different from canvas Submit. It is for validating the operation in settings and should not be expected to drive the full workspace graph.
- If `A -> B -> C` and `B` is missing a required request field, `A` can succeed, `B` fails and clears its response-derived outputs, and `C` does not execute from stale `B` data. Other independent branches can still run.
- Bound request fields can make the visible draft value look overridden. The submitted request uses the effective value after bindings and prefills are applied, not only what the local input currently shows.
- Hiding a request field from the card does not remove it from execution. Hidden mapped fields still submit if they have a bound value, prefill, default, or saved draft value.
- `showResponse` changes card presentation only. It does not create or remove response ports; downstream bindings read published outputs from runtime state.
- Notification banner mode and editable-form mode are response renderers, not different transport modes. Normal response ports remain available unless editable-form mode replaces them with editable-form outputs for the active response session.
- Editable-form outputs publish the current edited draft values, not only the original backend response. Refreshing the same `form_id` preserves matching local edits; a new `form_id` resets the session.
- Safe GET and HEAD responses may be cached during dashboard refresh or manual recalculation to avoid repeated identical calls across the graph. Manual Submit and settings Test request are intended to force fresh execution.
- OpenAPI discovery and runtime metadata enrichment can fail even when a saved binding spec exists. In that case the widget falls back to the saved compiled request form, but newer UI metadata from the live spec may not be available.
