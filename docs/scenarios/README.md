# Learn NCF with your own AI

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

Copy a prepared prompt into your usual AI chat and get a detailed guide in your language. Your model reads the NCF documentation, then explains a complete example: who takes part, what the agents say to each other, how the work develops and what direct messaging makes possible.

These 13 examples give the model a story to explain. You can follow any of them without a project of your own or an installed copy of NCF. Ask for a general introduction and the model will choose one example and explain it immediately. You can also choose a topic from the catalog and copy its prompt directly.

## Get an overview with an example

Copy this prompt into your AI chat. The model will include one detailed example without asking you to choose first, then offer the other topics. You can request any language without translating the prompt yourself.

```text
Introduce NCF Agent Interconnect and include one detailed example that
explains how people use it through their usual AI chats.

Read the complete product instructions:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt

Read the catalog of 13 examples:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md

Choose one example whose topic relates to our conversation. If there is no
clear focus, choose example 01, Two agents working directly. Read that
example's complete prompt and any user guides needed to explain it.
Do not ask me to choose or describe my own project first. You do not need
to read or compare all 13 prompts to explain one example.

Give a concise product introduction, explain your choice in one sentence,
then use the selected prompt to write a complete educational chapter.
The choice is already made: follow that prompt without restarting this
overview or selecting another example.

Write in the language of our conversation unless I request another.
Keep the story's fictional task, participants and environment. Explain
the preparation, example messages, decisions, changing work and outcome.
Show what direct messaging contributes and why each important exchange
matters. Do not require my files, accounts, equipment or project details.

Create documentation only. Participants, messages, checks and results are
illustrative. Do not perform the actions described in the story.
Use the documented NCF capabilities and limits. If a required source is
unavailable, identify it and request an accessible copy; do not invent its
content or present an unread source as supporting your explanation.

End with a link to the full catalog and invite me to choose other examples
by number or title. If I later ask a specific question, answer that question
directly without adding or repeating a scenario. If I request another
example, read its prompt and explain it directly.
```

## Choose what you want to understand

Each page contains a self-contained prompt. Copying one chooses that example: your model reads the product documentation and writes the guide immediately. There is no preliminary comparison or selection step.

| Example                                                                                | What you will learn                                                                      | What happens in the example                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [01. Two agents working directly](01-direct-pair.md)                                   | How direct questions and replies keep two working chats aligned.                         | An implementer and a verifier resolve an API disagreement in separate chats on one computer.         |
| [02. A team of peers](02-peer-team.md)                                                 | How specialists share decisions without a central coordinator.                           | Four agents clarify requirements, design, implement and verify reusable search views.                |
| [03. A coordinator and specialists](03-coordinated-team.md)                            | How one conversation gives an overview while specialists coordinate details directly.    | A developer's team adds participants for a new bug while feature work continues.                     |
| [04. Two developers on different computers](04-two-developers.md)                      | How agents connect work owned by different people and computers.                         | Backend and frontend agents on Mac and Windows resolve an API mismatch.                              |
| [05. A development cycle passed between specialists](05-sequential-delivery.md)        | How messages carry a task from one responsible specialist to the next.                   | Six agents take a filtering feature from analysis through independent checks to release preparation. |
| [06. A person and an agent at every stage](06-human-ai-stages.md)                      | How human decisions and agent exchanges fit into the same sequence.                      | Six specialists each work with an agent and approve their stage's result.                            |
| [07. Consultation and human approval](07-consultation-and-approval.md)                 | How agents obtain information and decisions while unrelated work continues.              | Three agents clarify conflicting requests and obtain approval for an API change.                     |
| [08. Parallel development stages](08-parallel-delivery.md)                             | How agents develop separate parts and share changes as work progresses.                  | Analysis, design, implementation and verification overlap around a saved-views feature.              |
| [09. Independent review and testing](09-independent-verification.md)                   | How findings reach the author directly and independent results reach the owner.          | A reviewer and tester find a remaining search-screen defect and check the author's correction.       |
| [10. Development and verification across operating systems](10-cross-platform-work.md) | How agents exchange evidence from the environments where it is available.                | A Windows tester and a Mac implementer investigate and correct an import failure.                    |
| [11. Handoff and earlier knowledge](11-handoff-and-memory.md)                          | How a new participant continues work and consults an earlier investigation.              | An incoming implementer receives a handoff and asks an older agent about import decisions.           |
| [12. An urgent fix alongside planned work](12-priority-fix.md)                         | How adding participants and changing priorities keeps existing work moving.              | A separate group handles an urgent import fix while the roadmap feature continues.                   |
| [13. Different applications and models](13-mixed-applications.md)                      | How supported applications exchange messages while retaining their own tools and access. | Agents in OpenCode, Cursor, Codex Desktop and AionUi contribute to one search-views feature.         |

People, AI agents, names and environments belong to the examples. An agent is a separate AI chat. Several chats in one supported application and one subscription can be enough; the examples with more applications or computers explain those arrangements without requiring you to have them. Roles, skills and project records are working conventions used in the stories.

## Make the explanation your own

The resulting guide explains the task and participants, the setup they would need, the initial requests and the messages exchanged as work develops. It shows human decisions, corrections and the outcome of the fictional task. Diagrams help explain the relationships and order of messages; the text remains understandable on its own.

Ask your model to explain an exchange more fully, simplify a diagram or rewrite a section in another language. A focused follow-up receives a direct answer. When you want another example, choose its number or title; you do not need to repeat the introduction.

The [user guide](../usage.md), [setup guide](../setup.md) and [application-specific instructions](../mcp-clients.md) supply the product details behind these explanations. The [full reference](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt) remains the source for supported features and limits. The generated story explains those features; it does not connect agents, change settings or perform the work it describes.
