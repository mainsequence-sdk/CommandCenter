# ADR: AppComponent as a Binding-Native API Widget

- Status: Proposed
- Date: 2026-04-02
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)

## Context

The workspace binding architecture already exists and is now the right foundation for cross-widget
composition:

- [`src/widgets/types.ts`](../src/widgets/types.ts) defines widget input/output metadata, binding
  edges, resolved inputs, and output resolvers.
- [`src/dashboards/types.ts`](../src/dashboards/types.ts) stores canonical graph edges on
  `DashboardWidgetInstance.bindings`.
- [`src/dashboards/widget-dependencies.ts`](../src/dashboards/widget-dependencies.ts) resolves
  inputs and builds the dependency graph from widget instances plus widget definitions.
- [`src/widgets/shared/WidgetBindingPanel.tsx`](../src/widgets/shared/WidgetBindingPanel.tsx)
  exposes a bindings editor driven by the same metadata.

That architecture works well for widget families with static ports, for example the Main Sequence
Data Node family:

- [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts)
  declares one static input and one static output through `io`.
- [`extensions/main_sequence/extensions/workbench/widget-contracts/mainSequenceDataSourceBundle.ts`](../extensions/main_sequence/extensions/workbench/widget-contracts/mainSequenceDataSourceBundle.ts)
  defines a stable producer-owned payload contract.

`AppComponent` does not fit the current static-port assumption:

- [`src/widgets/core/app-component/definition.ts`](../src/widgets/core/app-component/definition.ts)
  currently declares no `io`.
- [`src/widgets/core/app-component/appComponentModel.ts`](../src/widgets/core/app-component/appComponentModel.ts)
  derives request fields and response-model previews dynamically from the selected OpenAPI
  operation.
- [`src/widgets/core/app-component/AppComponentWidget.tsx`](../src/widgets/core/app-component/AppComponentWidget.tsx)
  and [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx)
  fetch the OpenAPI document asynchronously and build the form dynamically.

The product goal is to turn `AppComponent` into a composition primitive:

1. the selected endpoint request model dictates what can be bound as inputs
2. the selected endpoint response model dictates what can be bound as outputs
3. users can compose applications by wiring one API widget into another widget

The dependency layer must remain synchronous and pure. It should not fetch OpenAPI documents.

## Decision

We will make `AppComponent` the first widget that supports instance-scoped resolved ports.

### 1. Add instance-scoped resolved IO to widget definitions

`WidgetDefinition` will gain an additive pure resolver:

- `resolveIo?: (args) => WidgetIoDefinition | undefined`

This resolver must be:

- synchronous
- pure
- derived only from widget props, widget runtime state, widget id, and instance id

The dependency model, bindings editor, and graph extraction will use `resolveIo(instance)` first
and fall back to static `definition.io`.

### 2. Persist a compiled endpoint binding spec in AppComponent props

`AppComponent` settings will compile the selected OpenAPI operation into a serialized
`bindingSpec` stored in widget props.

The spec will contain:

- `version`
- `operationKey`
- `requestPorts`
- `responsePorts`

This makes the graph layer deterministic and network-free once settings has selected an endpoint.

### 3. Turn generated request fields into dynamic input ports

Each generated request field becomes one bindable input port.

Examples:

- `path:tradeId`
- `query:offset_days`
- `header:x-correlation-id`
- `body:rate`
- `body:trade.date`
- `body:raw`

The port id should stay aligned with the generated field key so request building and bindings refer
to the same stable identifier.

### 4. Turn the selected response model into dynamic output ports

`AppComponent` will expose outputs from one primary modeled response shape.

Default selection order:

1. first `2xx` JSON response with schema
2. first `2xx` response with schema
3. first modeled response

The output model will expose:

- one root JSON output: `response:$`
- object subtree JSON outputs when useful
- primitive leaf outputs for scalar composition

Examples:

- `response:$`
- `response:data`
- `response:data.id`
- `response:price`

### 5. Use shared core value contracts for AppComponent ports

`AppComponent` should not invent endpoint-specific contracts.

The first shared core contract family will be:

- `core.value.string@v1`
- `core.value.number@v1`
- `core.value.integer@v1`
- `core.value.boolean@v1`
- `core.value.json@v1`

Input ports may accept multiple compatible contracts. Output ports publish one concrete contract.

### 6. Bound inputs overlay local draft values at execution time

`AppComponent` will keep local draft values and runtime state.

At submit time it will:

1. start from local draft values
2. overlay valid resolved bindings by input id
3. build the request from the merged effective values

Bound fields should render as sourced and read-only in both widget view and settings test view.

### 7. Published outputs must align exactly with dynamic output port ids

`runtimeState.publishedOutputs` will become a stable `portId -> value` map for `AppComponent`.

Dynamic output resolvers will read from that map.

To avoid stale publication after an endpoint change, output publication and output resolution must
be guarded by the selected `operationKey`. A response captured for one operation must not satisfy
ports from a different operation.

### 8. Execution remains manual in the first slice

Bindings should not auto-submit API requests in the first implementation slice.

Users can bind upstream inputs into `AppComponent`, but request execution stays explicit through the
widget submit action and the settings test action.

### 9. Stale bindings degrade gracefully

If a user changes the selected endpoint and some ports disappear:

- removed downstream outputs become `missing-output`
- removed inbound input ids are ignored by the resolved IO model
- no automatic binding pruning is required in the first slice

## Compiled Binding Spec

The target serialized shape is:

```ts
interface AppComponentBindingSpec {
  version: 1;
  operationKey: string;
  requestPorts: Array<{
    id: string;
    fieldKey: string;
    label: string;
    description?: string;
    required: boolean;
    location: "path" | "query" | "header" | "body";
    kind: "string" | "number" | "integer" | "boolean" | "date" | "date-time" | "enum" | "json";
    accepts: WidgetContractId[];
  }>;
  responsePorts: Array<{
    id: string;
    label: string;
    description?: string;
    kind: "string" | "number" | "integer" | "boolean" | "date" | "date-time" | "enum" | "json";
    contract: WidgetContractId;
    responsePath: string[];
    statusCode: string;
    contentType: string | null;
  }>;
}
```

## Why This Option

This approach combines the strongest parts of the current repo architecture and the reviewed
proposal.

It keeps:

- canonical instance-level bindings
- a pure synchronous dependency model
- a pure graph extractor
- a binding UI driven by the same model

It avoids:

- fetching OpenAPI in the graph or dependency layer
- introducing a second non-canonical cross-widget composition system
- copying the older mixed Data Node pattern where widget-local source props and canonical bindings
  both compete for authority

## Rejected Alternatives

### Fetch OpenAPI documents inside the dependency model

Rejected because the dependency model must remain synchronous, serializable, and usable in graph
and settings surfaces without route-level network orchestration.

### Keep AppComponent outside the binding system and use widget-local sibling lookups

Rejected because it would repeat the older implicit composition pattern and prevent graph-safe
validation and editor support.

### Publish one giant endpoint-specific response bundle only

Rejected for the first slice because the user goal is field-level application composition. A single
opaque bundle would preserve transport but not usable port-to-port composition.

## Scope Of The First Implementation Slice

We will implement:

- instance-scoped `resolveIo` support in the widget platform
- resolved IO support in dependency resolution, graph extraction, and bindings UI
- compiled `bindingSpec` persistence in `AppComponent` props
- dynamic request input ports for `AppComponent`
- dynamic response output ports for `AppComponent`
- bound input overlay in runtime and settings test execution
- stable `publishedOutputs` keyed by dynamic port id

We will not implement yet:

- transforms on bindings
- multi-source fan-in behavior for API request fields
- automatic submit on upstream changes
- binding visual editor beyond the current settings panel
- multiple simultaneously published response variants
- multipart/file-aware port generation
- OpenAPI-driven graph resolution without prior endpoint compilation in settings

## Tasks Before Implementation Starts

These decisions should be locked before coding starts:

1. Confirm the core contract set for v1.
   Recommendation: `string`, `number`, `integer`, `boolean`, `json` only. Keep `date` and
   `date-time` represented through `string` contracts in v1.

2. Confirm the primary response selection rule.
   Recommendation: first modeled `2xx` JSON response, then first modeled `2xx`, then first modeled
   response.

3. Confirm stale output safety rules.
   Recommendation: all dynamic output publishing and output resolution must check `operationKey`.

4. Confirm first-slice execution semantics.
   Recommendation: bound inputs affect the request payload, but requests remain manually submitted.

5. Confirm first-slice UX for bound fields.
   Recommendation: render them read-only with a sourced indicator, not editable local inputs.

6. Confirm first-slice depth limit for response-port flattening.
   Recommendation: allow root JSON output plus shallow object subtrees and primitive leaves; do not
   recursively explode deep graphs in v1.

7. Confirm whether `WidgetInputEffect.target` needs a new `generated-field` kind.
   Recommendation: yes, if we want graph/editor metadata to distinguish generated request fields
   from static schema fields.

## Implementation Task List

### Platform

1. Add `WidgetIoResolverArgs` and `WidgetDefinition.resolveIo` in
   [`src/widgets/types.ts`](../src/widgets/types.ts).
2. If needed, extend `WidgetInputEffect.target` with `generated-field`.
3. Update the dependency model in
   [`src/dashboards/widget-dependencies.ts`](../src/dashboards/widget-dependencies.ts) to resolve
   per-instance IO with caching.
4. Add a hook such as `useResolvedWidgetIo` in
   [`src/dashboards/DashboardWidgetDependencies.tsx`](../src/dashboards/DashboardWidgetDependencies.tsx).
5. Update the bindings editor in
   [`src/widgets/shared/WidgetBindingPanel.tsx`](../src/widgets/shared/WidgetBindingPanel.tsx) to
   use resolved instance IO for both source outputs and target inputs.

### AppComponent Contracts And Model

6. Add shared core value contracts in
   `src/widgets/core/app-component/` or a shared core widget-contracts area.
7. Extend [`src/widgets/core/app-component/appComponentModel.ts`](../src/widgets/core/app-component/appComponentModel.ts)
   with:
   - `AppComponentBindingSpec`
   - binding-spec normalization
   - request-port compilation
   - primary-response selection
   - response-port compilation
   - response value extraction by path
   - bound-input overlay helpers
8. Extend [`src/widgets/core/app-component/definition.ts`](../src/widgets/core/app-component/definition.ts)
   so `AppComponent` exposes `resolveIo`.

### AppComponent Settings And Runtime

9. Update [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx)
   to compile and persist `bindingSpec` whenever the selected operation or request body content type
   changes.
10. Update [`src/widgets/core/app-component/AppComponentWidget.tsx`](../src/widgets/core/app-component/AppComponentWidget.tsx)
    to merge resolved bindings into effective request values before submit.
11. Update [`src/widgets/core/app-component/AppComponentFormSections.tsx`](../src/widgets/core/app-component/AppComponentFormSections.tsx)
    so bound fields render as sourced/read-only.
12. Change `publishedOutputs` generation so it publishes `portId -> value` for the current
    operation only.

### Validation, UX, And Documentation

13. Ensure stale bindings degrade to `missing-output` or ignored inputs without throwing.
14. Verify the dependency graph renders dynamic `AppComponent` ports correctly in settings/studio
    contexts.
15. Add docs updates to:
    - [`docs/core-widgets.md`](./core-widgets.md)
    - [`src/widgets/core/app-component/README.md`](../src/widgets/core/app-component/README.md)
    - [`src/widgets/README.md`](../src/widgets/README.md)

## Risks And Watchpoints

- Dynamic ports increase the amount of per-instance metadata the graph must render. Keep the first
  slice shallow and stable.
- Old `AppComponent` instances without `bindingSpec` must continue to work as non-binding widgets
  until settings recomputes the spec.
- Duplicating widgets currently clones widget trees structurally. Internal binding remapping should
  be reviewed before relying on duplicated composed applications as a primary workflow.

## This ADR Does Not Decide

- whether other widget families should adopt dynamic instance-scoped ports
- whether response models beyond the primary modeled response should be publishable at once
- whether bound inputs should eventually support transforms or fan-in
- whether the canvas should later expose a visual wire editor instead of settings-only binding
  editing
