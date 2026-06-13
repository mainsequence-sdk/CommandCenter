# Project Agent Deployment Logs Surface

## Purpose

This surface owns the standalone deployment-log view for project-agent automatic deployment runs.

It is intentionally separate from the project-agent configuration modal so opening logs changes
the routed app surface instead of expanding a panel inline.

## Files

- `ProjectAgentDeploymentLogsPage.tsx`
  The routed page. It fetches recent automatic deployment runs, renders status-specific operator
  summaries, and links back to the Workbench project page while preserving `msProjectUid` when
  present.

## Behavior Notes

- Reads
  `/orm/api/agents/v1/project-executor-automatic-deployment-runs/?ordering=-created_at&limit=20`.
- The endpoint is scoped to the authenticated user. Do not pass `created_by_user_uid` or legacy
  `created_by_user`.
- The current project UID is only preserved for navigation back to the related Workbench project.
  The logs request is not project-filtered unless the backend later exposes a project UID filter.
