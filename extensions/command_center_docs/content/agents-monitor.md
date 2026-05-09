# Agents Monitor

Agents Monitor is the Main Sequence AI surface for workspace-based agent sessions. It gives you a
curated workspace environment for monitoring, inspecting, and operating AI sessions without using a
generic workspace canvas.

## When To Use It

Use Agents Monitor when the work is driven by one or more AI sessions and you want that session
state, supporting context, and upstream inspection in one place.

## Core Workflow

1. Open `Main Sequence AI` and go to `Agents Monitor`.
2. Create a new monitor or reopen an existing one.
3. Launch a session-backed terminal from the monitor.
4. Add the supporting widgets needed for that session.
5. Use bindings to connect terminals, references, and inspectors where needed.

## What You Work With

Agents Monitor is intentionally narrower than a general-purpose workspace. It is designed around:

- session-backed agent terminals
- workspace references for supporting context
- upstream inspection when you need to see what a session or widget is consuming

## Good Practice

- Keep one monitor focused on one task or one session family.
- Name monitors clearly so they are easy to reopen later.
- Use supporting widgets only when they help the active session workflow.
- Prefer this surface over a generic workspace when the center of gravity is AI session work.
