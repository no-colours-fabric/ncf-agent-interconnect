# 02. A team of peers

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Let specialists ask each other for decisions and evidence while retaining clear ownership without a central coordinator.

- **Category:** Decentralized coordination.
- **Complexity:** Intermediate.
- **People:** 1 human project owner.
- **Agent chats:** 4 AI agents.
- **Example environment:** Separate chats in one supported application on one computer.

[Compare all 13 scenarios](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Copy-ready instruction

Copy the complete block into an AI chat. It starts with the full-catalog comparison unless that comparison and your choice are already recorded. The selected prompt produces an illustrative walkthrough; live work needs its own explicit scope.

```text
Target: scenario 02 — A team of peers.

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
Demonstrate task #T-1102: add reusable search views to a request-management
application. Use one human owner and four AI agents in separate chats: Alice
defines requirements, Theo designs the change, Leo implements it and Jade
verifies it. There is no coordinator.

Give each participant one main assignment and authority over its deliverable.
Show direct questions between peers, including Jade finding an ambiguity in
Alice's acceptance criteria before implementation finishes. Use analysis,
implementation and verification skills as appropriate. A shared decision note
and agreed artifact versions keep the team aligned; these are practices
maintained through the project's existing tools.

Define how the team identifies the next responsible participant, avoids
overlapping edits and selects who presents the combined result. Reporting the
result must not turn that participant into a hidden central coordinator.
Escalate an unresolved disagreement to the human owner without stopping
independent work.

Include a responsibility table and an interaction map. End with independent
verification, the agreed final artifacts and unresolved items. Show how a late
clarification reaches every affected chat.

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
