# Communication

Main Sequence AI is not only a single chat screen. It is the communication layer for working with
agents across the platform.

The important idea is that communication changes depending on what you are trying to do. Sometimes
you want a direct conversation. Sometimes you want a contextual side chat while you are already
working elsewhere in the platform. Sometimes you want agents to communicate with each other
programmatically without a person driving every turn.

## Three Ways To Communicate With Agents

### 1. Directly in the Main Sequence AI page

The full Main Sequence AI communication page is the most explicit way to talk to an agent.

Use it when the conversation itself is the main task:

- longer back-and-forth reasoning
- agent exploration
- reviewing session history
- stepping into an ongoing agent conversation

This is the right mode when you want to stay focused on one conversation and make the agent
interaction the center of the workflow.

### 2. Through the side chat with `Ctrl+J` or `Cmd+J`

The keyboard shortcut opens the side chat without forcing you to leave the page you are already
using.

This matters because the side chat carries the visible platform context with it. The agent can see
where you are working in Command Center, and that context helps it interpret your request more
accurately. In practice, that means the agent gets a better starting point for your inquiry than it
would from an isolated prompt with no surrounding product context.

Use the side chat when:

- you are already inside another application or surface
- the current page context matters to the question
- you want assistance without breaking the flow of what you are doing

### 3. Programmatically through A2A communication and discovery

Not every interaction with an agent has to start from a person typing into chat.

Main Sequence also supports agent-to-agent communication through A2A discovery and delegation. This
is the mode where one agent can discover another agent, decide that the second agent is the better
execution boundary, and hand work off programmatically.

This is the right mental model for:

- project agents collaborating with other agents
- orchestration flows
- delegation across capability boundaries

When you are building these workflows, the implementation boundary belongs in the
[Main Sequence SDK](https://pypi.org/project/mainsequence/).

## Sessions

Underneath these communication modes, Main Sequence works through `AgentSession`.

An `AgentSession` is the runtime conversation handle. It is what keeps the history, the current
runtime state, and the continuity of a conversation together.

That is why communication in Main Sequence feels persistent instead of stateless:

- reopening a session means continuing the same conversation
- inspecting a session means reviewing the real interaction history
- switching sessions means changing which conversation thread and runtime handle you are working on

The chat experiences are session-aware. They do not just send isolated prompts. They create, reuse,
and continue `AgentSession` records so the agent interaction has memory, traceability, and an
inspectable lifecycle.

## Choosing The Right Mode

Use `Communication` when the agent interaction itself is primary.

Use the side chat when platform context matters and you do not want to leave the current surface.

Use A2A communication when the real goal is not a human conversation but coordination between
agents.
