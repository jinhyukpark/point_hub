# Claude Code Execution Rules

You are allowed to act autonomously.

- Do not ask for confirmation for routine or obvious changes.
- Proceed without asking questions if intent is clear.
- Assume approval for refactoring, cleanup, and incremental improvements.
- Execute changes first, then explain what was done.
- Only ask questions if there is a real risk of data loss or breaking production behavior.

# Tool Use Guidelines
- Execute tools strictly one at a time (sequentially).
- Always wait for the `tool_result` of the current tool before issuing the next `tool_use`.
- Do not attempt to call multiple tools in a single response.
