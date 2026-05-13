# Project Agents

Project Agents turn each project into its own coding agent.

When you deploy a Project Agent, Command Center serves that agent on demand with the code,
environment, and execution surface of the underlying project. The goal is not just to create one
more chat endpoint. The goal is to let each project expose a focused agent that can work inside its
own boundary.

## Before You Deploy

Before a Project Agent can be deployed, the project needs a ready project image.

That image is the release artifact the agent runtime is built from. In practice, the Project Agent
is not deployed directly from your local working tree. It is deployed from a project image that
represents a concrete released state of the project.

To create or review that release artifact, open [Foundry Projects](/app/main_sequence_workbench/projects),
select the project, and use the `Images` tab. Once the project has a ready image, return to
`Project Agents` to build or deploy the project-specific agent runtime.

## The Core Idea

Instead of building one large workflow up front, you can let agents discover each other and divide
the work based on what each one is responsible for.

A Project Agent is useful because it narrows:

- the codebase the agent should operate on
- the environment and tooling it should use
- the compute and runtime surface it should consume
- the responsibility boundary it should own

That makes it easier to run agent collaboration without forcing every task through one broad,
general-purpose agent.

## How Discovery Works

Once deployed, a Project Agent becomes discoverable to other agents through the Main Sequence
agent-to-agent model.

That means another agent working in a shared surface can find the Project Agent and delegate work
to it when that project is the right place to act.

For organizations with more than one user, discoverability still follows sharing rules. Other users
and their agents can only discover a Project Agent when the underlying project is shared with them
as viewable or editable.

As of now, Main Sequence discoverability and agent import flows are limited to coding agents. If
you need an external agent to participate, the current pattern is to build that internal
communication inside a project and expose it through the project-owned agent boundary instead of
expecting the external agent to appear directly in discovery.

This limitation is temporary. Support for making external agents part of the discoverability model
is already in progress.

## Why This Matters

The value of Project Agents is that you do not need to hardcode every workflow in advance.

You can deploy project-specific agents, let them expose their own capability surface, and allow
other agents to involve them only when needed. That keeps the system more modular:

- one project agent can focus on one codebase or delivery boundary
- another agent can orchestrate across projects
- discovery and delegation happen through the platform instead of through manual wiring

## Agent Sessions And Traceability

Project Agents operate through `AgentSession`.

That matters because the work is not opaque. You can inspect the session history, trace the
conversations agents have with each other, and step into the conversation yourself at any time
through chat.

This gives you two things at once:

- autonomous execution between agents
- human visibility and intervention when needed

## Runtime

If you want to inspect one deployed Project Agent in more detail, open the agent and then open
`Runtime`.

This view is not only about whether the agent exists. It is where you inspect the operational state
of the deployed runtime. In practice, it gives you the same kind of runtime visibility you would
expect from jobs:

- resource consumption
- runtime status
- execution logs

That makes the runtime view the right place when the question is operational rather than
conceptual. If an agent feels slow, unstable, outdated, or unhealthy, this is where you inspect the
evidence.

### Agent Drift

Sometimes a Project Agent runtime may drift from the intended state of the project.

This can happen for two common reasons:

- the agent engine was updated
- your project received new commits after the current runtime image was released

When the drift comes from an engine update, the platform can reconcile that automatically as the
runtime is refreshed onto the newer agent engine.

When the drift comes from a project change, the meaning is different: the deployed Project Agent is
still running an image that does not include the latest commits from the project.

This matters because Project Agents are intended to be unique per project. Unlike jobs, where many
runs can coexist naturally, a Project Agent is meant to be the canonical discoverable agent for
that project. For discoverability to stay trustworthy, there should be one current project agent,
not multiple competing variants.

Because of that, drift is treated as a signal that the discoverable Project Agent no longer matches
the latest intended project state. In practice, a project is considered drifted when it has commits
that are not part of the currently released Project Agent image.

After you correct the drift, the Project Agent still needs to be redeployed manually. Updating the
project, rebuilding the image, or clearing the underlying cause does not automatically replace the
currently deployed discoverable Project Agent runtime.

## Communication Model

Project Agents communicate through the Main Sequence A2A protocol, and discoverability is handled
automatically by the platform.

Once a Project Agent is deployed, it becomes part of the agent network for the surfaces and users
that are allowed to see it.
