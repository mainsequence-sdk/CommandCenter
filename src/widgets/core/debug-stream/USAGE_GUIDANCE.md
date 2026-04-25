## buildPurpose

Bind to one upstream dataset and inspect the exact resolved source path, published runtime frame, and rendered preview in one place.

## whenToUse

- Use when a workspace binding resolves incorrectly and you need to inspect what a consumer widget is actually receiving.
- Use when a source widget should publish `core.tabular_frame@v1` and you need one neutral surface to verify that contract.
- Use when you want a fast debug surface that renders a graph when tabular time-series hints are present and a table otherwise.

## whenNotToUse

- Do not use as a production presentation widget. This widget exists for debugging bindings, runtime frames, and widget execution flow.
- Do not use to transform or author datasets. Connection Query and Tabular Transform own execution and shaping.

## authoringSteps

- Add the widget to the workspace.
- Open the `Bindings` tab and bind `sourceData` to an upstream widget output.
- Watch the preview render as a graph when `meta.timeSeries` is present or a table otherwise.
- Inspect the binding summary, upstream widget summary, and debug snapshot panels to trace what resolved.

## blockingRequirements

- The widget requires one upstream binding on `sourceData`.
- The bound output must resolve to `core.tabular_frame@v1`.

## commonPitfalls

- If the widget says it is still resolving upstream, the binding is valid but the published runtime frame is not visible to the consumer yet.
- This widget logs debug snapshots in development mode, but those logs do not replace the runtime summaries shown in the panel.
- The widget does not publish a downstream dataset. It is a terminal debug surface.
