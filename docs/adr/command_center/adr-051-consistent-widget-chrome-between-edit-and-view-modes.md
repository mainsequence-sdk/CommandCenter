# ADR 051: Consistent Widget Chrome Between Edit And View Modes

- Status: Accepted
- Date: 2026-05-02

## Context

The shared workspace canvas currently makes widget cards look different in edit mode and view mode.

Today the main drift comes from two behaviors in the shared widget host:

- widget headers can be forced visible in edit mode even when the instance is configured to hide
  its header in normal viewing
- widget action affordances live in the header band, so edit mode changes the effective card chrome
  and body proportions

This creates two UX problems:

1. A widget can change proportions between view and edit even when the widget body itself did not
   change.
2. Canvas editing starts to feel like a different surface instead of “the same widget with editing
   affordances”.

This is especially visible on presentation-oriented surfaces such as Slide Studio, where the user
expects edit mode to preserve the viewing composition.

The widget platform already has a shared presentation setting for header visibility. The issue is
not missing configuration; the issue is that the host currently overrides the configured result in
edit mode.

## Decision

The widget chrome contract must preserve the same card proportions in edit mode and view mode.

We accept the following rules:

1. `showHeader` remains the canonical header-visibility property.
2. If a widget instance hides its header, the header stays hidden in both edit mode and view mode.
3. Edit mode must not force a header back on just to expose drag or actions.
4. Widget actions must move out of the header flow and become a static top-right overlay anchored
   to the card itself.
5. The top-right action anchor must exist whether the header is visible or hidden.
6. Edit-mode drag affordances must also stop depending on header presence. They should be provided
   through non-layout-affecting chrome rather than by changing the rendered card structure.
7. The shared widget renderer must keep one geometry contract across root canvas and slide subgrid
   hosts.

## Consequences

### Positive

- Edit mode and view mode keep the same widget proportions.
- Slide editing better matches presentation viewing.
- Widgets with hidden headers no longer grow a different top band in edit mode.
- Shared widget chrome becomes simpler to reason about: header visibility is one property, not one
  property plus one edit-mode override.

### Negative

- The host needs a new drag affordance strategy for headerless cards.
- Some widgets may currently rely on the forced header to make edit interactions discoverable, so
  the overlay affordances need to be designed carefully.

## Rejected Alternatives

### Keep forcing headers in edit mode

Rejected because it makes the same widget render with different proportions across modes, which is
exactly the UX problem this ADR is fixing.

### Put widget actions below the header or inside the widget body

Rejected because body-level actions still change proportions and widget-local actions are not a
shared canvas contract.

### Introduce a second “edit header visibility” property

Rejected because the platform already has one header-visibility setting. A second property would
codify drift instead of removing it.

## Implementation Tasks

- [x] Stop forcing headers visible in edit mode in the shared workspace widget host.
- [x] Keep `showHeader` as the only shared header visibility control for widget cards.
- [x] Move the shared widget action menu to an absolute top-right overlay that does not consume
      layout space.
- [x] Ensure the action overlay works identically when the header is shown or hidden.
- [x] Introduce a non-layout-affecting drag affordance for edit mode so headerless widgets remain
      draggable without changing card proportions.
- [x] Keep the same widget chrome contract in both the root canvas host and the slide subgrid host.
- [x] Review row/structural widget exceptions separately so this ADR only changes normal widget-card
      behavior.
- [x] Update shared workspace and widget documentation after implementation.

## Backend Contract Impact

No backend contract change is required if this ADR is implemented on top of the existing shared
header-visibility presentation field.

This ADR is intentionally about frontend widget chrome and host rendering behavior, not workspace
serialization.
