# 09. Independent review and testing

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

See how independent reviewers send findings straight to the author, follow corrections and report their own results.

- **Topic:** Quality and correction loops.
- **People in the example:** 2 human owners for implementation acceptance and test limits.
- **Agent chats in the example:** 3 AI agents.
- **Example environment:** Separate implementation, code-review and behavioral-test chats.

[Browse all 13 examples](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Prompt for your AI

Copy the complete prompt into your usual AI chat to get a detailed guide in your language. It explains the example below using the product documentation; you do not need your own project or an installed copy of NCF Agent Interconnect.

```text
Write a guide using example 09 — Independent review and testing.

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
Demonstrate bug #B-0321 in a React/TypeScript search screen: an older response
replaces results from a newer query. Use AI agent Sam for implementation, Iris
for code review and Jade for behavioral testing. A human maintainer accepts
the change; a human test owner assesses remaining verification limits.

The first candidate prevents stale results but leaves the loading indicator
active when a request is superseded. Show the finding going directly to Sam, a
revised candidate, and a targeted recheck of both behaviors. Each finding
identifies the candidate revision, reproduction, expected behavior, observed
behavior and requested correction. Iris and Jade independently send their
final reports to the appropriate human owners.

Use implementation and verification skills. The author's check summary is
input, not independent evidence. Recheck changed behavior and affected
requirements; do not repeat an unrelated full suite or invent extra failed
iterations.

Show the participants agreeing on an escalation point, such as three
unsuccessful correction cycles.
Unresolved disagreements return to the responsible person. End with the exact
accepted candidate, each independent result and remaining limits.

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
