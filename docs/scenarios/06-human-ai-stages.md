# 06. A person and an agent at every stage

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Explore how people retain responsibility for decisions while their agents prepare work and pass agreed results to the next stage.

- **Topic:** Human decisions at stage boundaries.
- **People in the example:** 6 human specialists, one responsible for each stage.
- **Agent chats in the example:** 6 AI agents, one for each human specialist.
- **Example environment:** The team's computers and supported applications.

[Browse all 13 examples](README.md) · [User guide](../usage.md) · [Setup](../setup.md)

## Prompt for your AI

Copy the complete prompt into your usual AI chat to get a detailed guide in your language. It explains the example below using the product documentation; you do not need your own project or an installed copy of NCF Agent Interconnect.

```text
Write a guide using example 06 — A person and an agent at every stage.

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
Demonstrate task #T-1106: introduce saved search filters into a shared
business application. Use six human specialists and six AI agents. Pair human
business analysis with Alice, architecture with Theo, development with Leo,
code review with Iris, quality assurance with Jade and release preparation
with Morgan. Distinguish every person from their agent in the participant
table.

At each stage, the agent prepares a deliverable. The responsible person checks
it, corrects assumptions and approves the exact artifact version before the
next dependent stage. Define an approval record containing the responsible
person, decision, version and conditions. Keep it in the team's existing
project records; NCF Agent Interconnect carries the questions and decisions.

Include a rejected design and its revised submission. Missing answers leave
dependent transitions pending while unrelated authorized work continues. A
materially changed artifact needs approval covering that change. Do not ask
for a fresh human confirmation of every routine agent exchange inside an
approved stage.

Distinguish human decisions from delivery receipts in the story. End with
the independently checked result and a distinct publication decision.

Guide to produce:
Write a readable guide about the people's goal and how the work develops.
Open with the practical need, a compact participant table and only the setup
needed to understand the story. Link to the relevant setup guide; do not ask
the reader to perform setup.

Tell the story in order through four to six meaningful exchanges. Show short
messages as ordinary chat quotations with the sender and recipient named,
in the guide's language. A style example only; use the actual people, agents
and issue in this story:
**Sam → Leo:** "The date is missing from the screen. Can you check the field?"
**Leo → Sam:** "I found the mismatch. I'll correct it and ask you to check again."
Use these lines only as a formatting example. Write new messages about the
selected story, with its own participants, and translate them when needed.
After each exchange, explain in one or two sentences what the participants
learned, decided or did next. Make the value of direct messaging clear.

Keep messages readable. Do not show JSON, code fences, tool calls such as
agent_send, reply references, protocol fields, message IDs, raw attachment
objects or invented commit hashes as dialogue. If a technical detail explains
a user-visible problem, mention only that detail in brief prose outside the
quoted message. Summarize files or specifications by purpose rather than
pasting their contents. Use a simple example of the user's opening request,
in natural language; in English, "Connect as agent Name" is enough. Do not put
"AI" in words attributed to the user. Identify AI agents clearly in narration.

Give each working chat one main assignment. Example skills may come from
coordination, analysis, implementation and verification. Task, bug and issue
numbers such as #T-1101, #B-0321 and #I-0201 are story conventions, not
product requirements. Use the full product name NCF Agent Interconnect.
Distinguish its documented messaging from agent instructions and external
project tools. Message receipt is not task completion. Do not promise model
response times, universal idle-chat wake, transferred permissions or a task
scheduler. Use the current application support in llms.txt.

End with the illustrative result, what the people would check, human decisions
and remaining limits. Never present fictional checks as real evidence. Explain
the lesson without presenting this arrangement as a required workflow.
Keep the guide easy to scan. Do not add diagrams or illustration briefs unless
the reader specifically asks for one.

Finish with the catalog link above and invite the reader to choose another
example. Answer later specific questions directly, without repeating a whole
example or adding a catalog invitation. Adapt the language and detail when asked.
```
