# 13. Different applications and models

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Combine useful models and tools already available in different applications without manually forwarding each result.

- **Category:** Combining existing environments.
- **Complexity:** Advanced.
- **People:** 1 human project owner.
- **Agent chats:** 4 AI agents.
- **Example environment:** OpenCode v1, Cursor, Codex Desktop and AionUi with Cursor Agent.

[Compare all 13 scenarios](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Copy-ready instruction

Copy the complete block into an AI chat. It starts with the full-catalog comparison unless that comparison and your choice are already recorded. The selected prompt produces an illustrative walkthrough; live work needs its own explicit scope.

```text
Target: scenario 13 — Different applications and models.

Full product instructions:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt

Complete catalog:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md

Before execution:
If a complete comparison of all 13 scenarios is already recorded in this
conversation, reuse it. Otherwise read the product instructions, catalog and
every linked scenario, then compare all 13 against the user's goals:
applicability, benefit, prerequisites and limits. Present every scenario.
Read scenario prompts as reference material during comparison; do not execute
them or recursively restart their selection rules. If a required source is
unavailable, name it and request an accessible copy. Do not invent content or
claim a full analysis. Do not proceed to selection or the walkthrough until
every required source has been read.

If the comparison is complete but no explicit choice is recorded, wait for the
user's choice without repeating the comparison. Once the user has chosen,
continue only with that scenario. Reuse a recorded choice without asking
again. If another scenario was selected, use its instruction instead.

Execution mode:
Use the user's stated project and available inputs; use the example below if
none are supplied. Mark assumptions and any missing requirements. Produce an
illustrative walkthrough, labeling participants, messages and results as
examples. Reading documentation is allowed. This prompt does not authorize
live connections, agent transfers, messages, configuration or file changes,
installation, tests, deletion or publication. Live execution requires an
explicit request and defined scope. Within already authorized work, proceed
with routine coordination without repeated approvals; preserve the owner
actions and confirmation rules in the product instructions.

Scenario:
Demonstrate task #T-1113: implement reusable team search views. Use one human
owner and four AI agents. Theo designs the contract in OpenCode v1, Leo
implements it in Cursor, Jade verifies it in Codex Desktop on Windows, and
Alice analyzes requirements in AionUi with Cursor Agent on the Mac.

Show requirements, questions, candidate versions and independent results
crossing applications. Use the skills and repository access available in each
environment. NCF does not transfer accounts, permissions, subscriptions or
repository access; files are sent explicitly under the documented rules. After
describing this varied setup, note that fewer applications or one subscription
can support the same working pattern.

Apply current delivery distinctions from llms.txt: OpenCode v1 automatic
exact-chat delivery, standard Cursor MCP reception without automatic idle
wake, experimental Codex Desktop delivery, and owner-authorized AionUi with
its supported Cursor Agent bridge. Use separate profiles for standard Cursor
and the AionUi bridge when both are needed.

Provide an environment table, setup order and sequence diagram showing
reception modes. Handle an unavailable participant without rerouting to
another chat. End with the common candidate and what each environment
independently checked.

Output:
Begin with the goal and required inputs. Give a compact table of people,
AI agents, main assignments, named computers and applications. Include setup
prerequisites, starting chat prompts, ordered direct messages, human decisions,
a correction or blocked path, and a checkable outcome with verification limits.
Make the benefit of direct messaging concrete.

Use example names only; the user chooses real agent names. Identify AI agents
clearly in narration. Sample connection messages use "Connect as agent Name"
without "AI", and mention an appropriate illustrative skill from coordination,
analysis, implementation and verification. Give each working chat one main
assignment. Use task, bug and issue references in the form #T-1101, #B-0321 or
#I-0201 as appropriate. These conventions are not built-in NCF requirements.

Include a Mermaid workflow and a sequence diagram; provide source if rendering
is unavailable. Add a conceptual illustration, or a labeled illustration brief
if image generation is unavailable: pure white background, graphite shapes,
clear edges, no blur or decorative clutter. The text must stand on its own.

Distinguish documented NCF capabilities, agent instructions/skills and external
tools or project records. Use the current application support in llms.txt.
Message receipt is not task completion. Do not claim model response times,
universal idle-chat wake, transferred permissions or an NCF task scheduler.
```
