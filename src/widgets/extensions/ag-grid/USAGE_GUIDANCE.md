## buildPurpose

Legacy AG Grid positions table.

## whenToUse

- Use only when this legacy extension widget is explicitly required.

## whenNotToUse

- Do not use when the newer typed portfolio widgets cover the same need.

## authoringSteps

- Add the widget to a surface where the legacy positions API is available; this widget fetches its
  own positions snapshot and does not consume the modern typed workspace binding graph.

## commonPitfalls

- This widget is not part of the modern typed workspace runtime model.
- This widget owns a local query rather than a shared upstream dataset binding, so it will show its
  own loading, error, and empty states instead of participating in the progressive upstream
  hydration contract used by graph-bound workspace widgets.
