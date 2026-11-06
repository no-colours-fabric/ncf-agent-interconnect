# 12. An urgent fix alongside planned work

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Give an urgent defect its own participants and release priority while planned development continues.

- **Category:** Changing priorities and team composition.
- **Complexity:** Advanced.
- **People:** 1 human project owner.
- **Agent chats:** 7 AI agents, or 8 with a coordinator.
- **Example environment:** Separate chats and working copies for the feature and urgent fix.

[Compare all 13 scenarios](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Copy-ready instruction

Copy the complete block into an AI chat. It starts with the full-catalog comparison unless that comparison and your choice are already recorded. The selected prompt produces an illustrative walkthrough; live work needs its own explicit scope.

```text
Target: scenario 12 — An urgent fix alongside planned work.

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
Demonstrate task #T-1042, saved filters, continuing while bug #B-0317 blocks
imports. One human owner controls priorities and publication. The roadmap has
four AI specialists: Alice for requirements, Theo for design, Leo for
implementation and Jade for verification.

Add three participants for the urgent work: Iris investigates, Sam fixes and
Nora verifies. Keep each chat's main assignment focused. Compare two
arrangements within this scenario: Morgan coordinates the work, or the task
owners coordinate directly under agreed rules.

The owner asks for the independently verified fix to ship first if the feature
is not ready. Do not pause the feature or describe it as needing to resume.
Show separate Git branches, ownership of overlapping changes and agreement
about integrating the fix into continuing work. Questions, reproductions and
findings travel directly between the responsible chats.

Include a timeline, parallel-flow diagram and separate outcome summaries. A
failed urgent check returns directly to Sam; Nora reports verification
independently. Publication remains within the owner's authorization. Explain
what a conflict blocks and which unaffected work continues. NCF communicates
the work; Git and release tools perform their own actions.

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
