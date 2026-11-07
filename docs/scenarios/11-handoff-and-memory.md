# 11. Handoff and earlier knowledge

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Explore how a new participant continues earlier work with a handoff and knowledge from an older chat.

- **Topic:** Continuity and knowledge reuse.
- **People in the example:** 1 human project owner.
- **Agent chats in the example:** 4 AI agents, including an outgoing and incoming implementer.
- **Example environment:** Existing and new chats, plus an older research chat.

[Browse all 13 examples](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Prompt for your AI

Copy the complete prompt into your usual AI chat to get a detailed guide in your language. It explains the example below using the product documentation; you do not need your own project or an installed copy of NCF Agent Interconnect.

```text
Write a guide using example 11 — Handoff and earlier knowledge.

Full product instructions:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt

Complete catalog:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md

Read before writing:
Read the complete product instructions above and the linked user guides needed
to explain this example accurately. Use the catalog to find other examples;
reading all 13 prompts is not a prerequisite. If a required source is
unavailable, identify it and request an accessible copy. Do not invent its
contents or present unsupported details as documented behavior.

Create documentation:
Write a detailed, self-contained guide in the language of our conversation,
unless I request another language. Keep the situation, participants and main
events below. Supply coherent fictional details and synthetic sample data
where needed. I do not need to provide a project, have NCF Agent Interconnect installed or match
the example's equipment. Do not replace the story with my real work or ask me
to choose again.

Explain the example directly. This selected example also satisfies the
example required in a general overview of NCF Agent Interconnect; do not add another or restart
selection. All dialogue, checks and outcomes belong to the illustration.
Produce the guide and its explanatory visuals only; do not connect agents,
send real messages, change files or settings, install software, run tests or
publish.

Example to explain:
Demonstrate task #T-1111: continue a partly implemented import preview. Use
one human project owner and four AI agents. Theo owns the existing design, Sam
is the outgoing implementer, Leo becomes the new implementer and Oscar holds
knowledge from an earlier investigation.

Sam prepares a handoff: goal, accepted decisions, current revision, available
artifacts, completed work, unresolved issues, checks and next steps. The owner
names Leo as successor. Leo confirms access to the material and explains the
next action before continuing. Show Leo asking Oscar for relevant decisions and examples;
check their applicability today. If Oscar is unavailable, use retained records
and state what remains unknown.

Distinguish assigning a task to Leo from continuing Sam's identity in another
chat. In the latter path, show the owner's explicit approval for a transfer
preserving NCF Agent Interconnect history. Do not imply automatic transfer of the AI
application's full transcript, skills, permissions, account or repository
access.

Provide a reusable handoff template and diagrams for both paths. Success means
the new owner can locate the material, explain remaining work and continue
within scope. Mark unfinished verification for the next stage.

Guide to produce:
Start with what this example will help the reader understand and the problem
faced by the people in the story. Introduce a compact table of people,
AI agents, main assignments, named computers and applications. Describe the
preparation those participants need, with links to the relevant setup guides;
do not require the reader to carry it out.

Tell the story in order using concrete starting prompts, direct agent
messages, human decisions and the correction or blocked path. After each
important exchange, explain why it happened, what changed and how NCF Agent Interconnect carries
the information to the next participant. Make instant, direct messaging and
its benefit visible through the dialogue. Distinguish message exchange from
the model's time to answer or complete work.

End the story with its illustrative outcome, what the participants would
check and what remains unresolved. Never present fictional reports, revisions
or test results as evidence of work actually performed. Explain which lessons
the example reveals without presenting its arrangement as a required workflow
or a universally recommended practice.

Use the full product name NCF Agent Interconnect; do not abbreviate it.
Identify AI agents clearly in narration. Use the example names and give each
working chat one main assignment. In illustrative user messages, use
"Connect as agent Name" without "AI", and mention an appropriate example skill
from coordination, analysis, implementation and verification. Use task, bug
and issue references such as #T-1101, #B-0321 and #I-0201. Names, roles, skills
and task labels are conventions for the story, not built-in NCF Agent Interconnect requirements.

Include a Mermaid workflow and a sequence diagram; provide source if rendering
is unavailable. Add a conceptual illustration, or a labeled illustration brief
if image generation is unavailable: pure white background, graphite shapes,
clear edges, no blur or decorative clutter. The text must stand on its own.

Distinguish documented NCF Agent Interconnect capabilities, agent instructions/skills and external
tools or project records. Follow current application support in llms.txt.
Message receipt is not task completion. Do not claim model response times,
universal idle-chat wake, transferred permissions or an NCF Agent Interconnect task scheduler.

Finish with a link to the complete catalog above and invite the reader to
choose another example or ask for a clearer explanation of part of this one.
Answer later specific questions directly, without adding or repeating a whole
example or appending a catalog invitation. Adjust the language, detail and
presentation when requested.
```
