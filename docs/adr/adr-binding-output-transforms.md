# ADR: Binding-Level Output Transforms for Structured Widget Outputs

- Status: Accepted
- Date: 2026-04-02
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)

## Context

The current widget binding engine already gives the platform the right foundation for composition:

- canonical `WidgetPortBinding` storage on widget instances
- dynamic/static port resolution through `io` and `resolveIo`
- output value resolution through `resolveValue`
- resolved inputs and graph extraction through the shared dependency model
- a shared settings-side `WidgetBindingPanel`

That architecture works for widgets whose outputs are already flat and scalar. It breaks down when a
source output is structured JSON and the consuming input needs only one nested field.

Example:

- source widget output port: `response:$`
- source output value:
  `{ "context": { "date": "2026-04-02", "data": { ... } } }`
- target widget input port: `effectiveDate`

Today the engine validates compatibility directly against the root output contract. If the root
output is `core.value.json@v1`, it cannot bind to a `core.value.string@v1` input even though the
nested value at `context.date` would be valid after projection.

`AppComponent` currently works around this partially by flattening response models into extra
widget-specific ports. That is useful, but it is not a general platform capability and it should
not become the only way to bind nested values.

## Decision

We will keep the graph and canonical bindings port-to-port, and add a binding-level transform layer
for projecting nested values out of structured outputs.

### 1. Graph topology stays port-to-port

The graph remains:

- source widget
- source output port
- target widget
- target input port

Nested extraction is metadata on the binding edge, not a new graph node model and not a widget-only
prop hack.

### 2. Flat outputs stay the default

Widgets should continue to expose obvious flat outputs when they are useful. This is especially
important for `AppComponent`, because flat scalar outputs make it easy to feed API responses into
simple widgets without extra configuration.

Structured exploration is a fallback for outputs that are objects, arrays, or otherwise too rich
to flatten exhaustively.

### 3. Binding compatibility is evaluated after transformation

The engine must no longer validate compatibility only against the root output contract.

The correct pipeline is:

1. resolve source widget and source output port
2. resolve the raw source value
3. determine a value descriptor for that output
4. apply any binding transform
5. validate the transformed contract against the target input
6. expose the transformed value through the resolved input model

### 4. Output ports may describe structured values

`WidgetOutputPortDefinition` will gain optional structured-value metadata through a generic
`WidgetValueDescriptor`.

This descriptor is the platform-wide way to describe nested object/array/primitive output shape.

Widgets that know their output schema ahead of time, such as `AppComponent`, should populate it
statically. Widgets that do not should still work through runtime shape inference.

### 5. Binding transforms are an ordered pipeline

Bindings support an additive, ordered transform model.

The supported transforms in this slice are:

- `select-array-item`
- `extract-path`

`select-array-item` resolves one element from an `array<...>` output before compatibility is
checked. Supported selection modes are:

- `first`
- `last`
- `index`

`extract-path` projects a nested object path such as:

- `["context", "date"]`
- `["defaults", "options", "currency"]`

The transform pipeline remains explicit and shallow. We are not adding a general expression
language or path DSL such as `results[0].id`.

### 6. The binding UI should show outputs first, then compatibility

The shared binding panel should:

1. let the user pick a source widget
2. let the user pick a source output port
3. if the output is structured, optionally choose `Use whole output` or `Extract nested field`
4. if the output is an array, optionally choose `Use whole collection`, `Use first item`, `Use last item`, or `Use item at index`
5. if the selected value is structured, optionally choose `Use whole value` or `Extract nested field`
6. then show whether the transformed output is compatible with the target input

Incompatibility should be explained, not hidden through premature filtering.

## Data Model

### Binding

Canonical bindings remain port-to-port and gain optional transform metadata:

```ts
interface WidgetPortBinding {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSteps?: WidgetBindingTransformStep[];
  transformId?: string;
  transformPath?: string[];
  transformContractId?: WidgetContractId;
}

type WidgetBindingTransformStep =
  | {
      id: "select-array-item";
      mode?: "first" | "last" | "index";
      index?: number;
    }
  | {
      id: "extract-path";
      path?: string[];
      contractId?: WidgetContractId;
    };
```

Legacy `transformId` / `transformPath` / `transformContractId` stay in the model as a backward-
compatible mirror for old dashboards and persisted payloads. New multi-step bindings use
`transformSteps` as the canonical representation.

### Output descriptor

Outputs may describe their value shape through a generic descriptor:

```ts
type WidgetValueDescriptor =
  | {
      kind: "primitive";
      contract: WidgetContractId;
      primitive: "string" | "number" | "integer" | "boolean" | "null";
      format?: string;
      description?: string;
    }
  | {
      kind: "object";
      contract: WidgetContractId;
      description?: string;
      fields: Array<{
        key: string;
        label: string;
        description?: string;
        required?: boolean;
        value: WidgetValueDescriptor;
      }>;
    }
  | {
      kind: "array";
      contract: WidgetContractId;
      description?: string;
      items?: WidgetValueDescriptor;
    }
  | {
      kind: "unknown";
      contract: WidgetContractId;
      description?: string;
    };
```

## AppComponent Guidance

`AppComponent` should use this platform capability, not replace it.

It should:

- keep convenient flat leaf response outputs
- add a structured root response output such as `response:$`
- attach a descriptor derived from the selected OpenAPI response model

This gives both:

- simple flat API chaining
- nested response extraction when the desired field is not already flattened

## Scope

This ADR covers the implementation slice we will land now:

1. add `WidgetValueDescriptor` and binding-transform fields to widget types
2. add shared transform utilities and runtime descriptor inference
3. update the dependency engine to resolve outputs and apply transforms before validation
4. expose resolved outputs to the binding UI
5. update the binding panel with collection-item selection plus nested-path extraction
6. keep legacy single-step bindings working while persisting the new ordered transform steps
7. update graph/edge diagnostics without changing graph topology
8. update docs and module READMEs

## Non-Goals

This ADR does not decide:

- expression-based transforms
- arbitrary array filtering or lookup expressions
- graph-level rendering of nested paths as separate nodes
- removal of existing flat output ports from `AppComponent`

## Implementation Tasks

1. Extend `src/widgets/types.ts` with:
   - `WidgetValueDescriptor`
   - binding transform fields on `WidgetPortBinding`
   - `valueDescriptor` on `WidgetOutputPortDefinition`
   - transformed-value metadata on resolved inputs

2. Add a shared transform module under `src/dashboards/` for:
   - runtime descriptor inference
   - nested path enumeration
   - nested path lookup
   - array-item selection
   - ordered transform-step application

3. Update `src/dashboards/widget-dependencies.ts` to:
   - normalize new binding fields
   - resolve output previews
   - apply transforms before contract validation
   - return explicit `transform-invalid` diagnostics

4. Update `src/dashboards/DashboardWidgetDependencies.tsx` to expose resolved outputs to UI hooks.

5. Update `src/widgets/shared/WidgetBindingPanel.tsx` to:
   - show source widgets and source outputs
   - show collection handling for array outputs
   - show nested-path selection for structured outputs or selected array items
   - preview transformed values and derived contracts
   - show compatibility after transformation

6. Update `src/widgets/core/app-component/` to:
   - emit a structured root response output
   - attach response-model-derived descriptors
   - keep flat response outputs for the default path

7. Update docs:
   - `docs/README.md`
   - `docs/core-widgets.md`
   - `src/widgets/README.md`
   - `src/widgets/core/app-component/README.md`
