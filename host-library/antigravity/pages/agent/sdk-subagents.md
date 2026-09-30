# Multi-agent subagent delegation

Orchestrate complex tasks across specialized subagents with isolated toolsets and execution contexts.

Subagents can help your main agent work on complex tasks. The main agent can decompose a task and delegate subtasks to subagents where each subagent has its own independent context window.

Depending on your use case, you can leverage [dynamic self-cloning subagents](#dynamic-self-cloning-subagents) or [static custom subagents](#static-custom-subagents).

## Dynamic self-cloning subagents

Your main agent can create subagents that inherit its permissions and toolsets.

For example, you can enable dynamic subagent creation during execution so that your main agent can spawn subagents on demand:

```
from google.antigravity import Agent, LocalAgentConfig, types

config = LocalAgentConfig(
    capabilities=types.CapabilitiesConfig(enable_subagents=True)
)

async with Agent(config) as agent:
    response = await agent.chat("Decompose and audit this codebase.")
    print(await response.text())
```

## Static custom subagents

You can leverage the SDK to define subagents that have dedicated tools or specific system instructions that are different from the main agent. Note that any custom tools assigned to a subagent must also be registered in the parent agent’s `tools` list.

For example, you can configure a subagent that specializes in code reviews:

```
from google.antigravity import Agent, LocalAgentConfig, types

def my_custom_reviewer_tool(file_path: str) -> str:
    """Audits docstrings in a python file."""
    # Add your custom tool logic here
    return f"Verified {file_path}"

reviewer = types.SubagentConfig(
    name="code_reviewer",
    description="Audits source code for style compliance.",
    system_instructions="Check function docstrings in Python files.",
    tools=[my_custom_reviewer_tool],
)

config = LocalAgentConfig(
    tools=[my_custom_reviewer_tool],
    subagents=[reviewer],
)

async with Agent(config) as agent:
    response = await agent.chat(
        "Check function docstrings in Python files under src/."
    )
    print(await response.text())
```

## Sample code

For full working code examples, see the GitHub repository:

*   [`subagents.py`](https://github.com/google-antigravity/antigravity-sdk-python/blob/main/examples/getting_started/subagents.py)
