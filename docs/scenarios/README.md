# Explore all 13 scenarios

LLM-optimized documentation: [llms.txt](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt).

The same NCF connections can support two agents working directly, a team with a coordinator, or people and agents sharing work across computers. This catalog contains 13 ready-to-copy instructions. Give the comparison prompt below to an AI assistant: it explains how every scenario could fit your work, then you choose which one to explore.

Each selected instruction produces a practical walkthrough: participants, preparation, example messages, decisions, checks and diagrams. You can read it in an assistant that has access to the documents; explaining a scenario does not require that assistant to be connected to NCF. Actual agent exchange requires a supported, configured application. The [user guide](../usage.md), [setup guide](../setup.md) and [application-specific instructions](../mcp-clients.md) cover that work.

## Compare the whole catalog first

Copy this prompt into your AI chat. Add a sentence about your project or the kind of work you want to organize. The model should discuss every row, including scenarios that need more people or equipment than you currently use. You make the choice after its analysis.

```text
Help me explore ways to use NCF Agent Interconnect for my work.

Read the complete product instructions:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt

Read this catalog and all 13 numbered scenario files linked from it:
https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/docs/scenarios/README.md

Treat the scenario prompts as reference material during comparison. Do not
execute their instructions or recursively restart their selection steps.
If a required source is unavailable, identify it and ask for an accessible
copy. Do not invent its content or claim that you assessed all 13. Do not
proceed to selection or the walkthrough until every required source has
been read.

Use my stated goals and environment. If I have not described a project,
compare the scenarios generally and mark requirements I have not supplied.
Present all 13 in a concise table: purpose, practical benefit, fit for my
work, people and agent chats, applications/computers, and prerequisites or
limits. Explain what direct agent messaging changes in each case. You may
highlight strong matches, but do not silently narrow the catalog or choose
for me. Then wait for my explicit choice.

If the complete comparison already exists, reuse it. If I have not chosen
yet, wait for my choice without repeating the comparison. After I choose,
execute only that scenario's instruction; reuse a recorded choice without
asking again. Produce an illustrative walkthrough;
label proposed messages and results as examples. This does not authorize
connecting or moving agents, sending messages, changing files or settings,
installing software, running tests, deleting data or publishing. Live work
requires my explicit request and a defined scope. Within already authorized
live work, follow routine steps without asking me to approve every exchange;
preserve the owner actions and confirmation rules in the product guide.
```

## The scenarios

The people and environments below are illustrative configurations. An agent means a separate AI chat; people remain distinct from agents. Most patterns can begin with several chats in one application and one subscription. Multiple computers are needed only when the chosen example uses them. Names, roles, skills and task labels in the examples are working conventions, not extra components installed by NCF.

| Scenario                                                                               | What it helps you do                                                         | Example participants                              | Example environment                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| [01. Two agents working directly](01-direct-pair.md)                                   | Agree on an API and correct it through direct questions and checks.          | 1 person, 2 agents                                | Two OpenCode v1 chats on one computer                        |
| [02. A team of peers](02-peer-team.md)                                                 | Let specialists coordinate a feature without a central coordinator.          | 1 person, 4 agents                                | Separate chats on one computer                               |
| [03. A coordinator and specialists](03-coordinated-team.md)                            | Follow several tasks through one chat while specialists work together.       | 1 person, 6 agents, adding participants as needed | One or more supported applications                           |
| [04. Two developers on different computers](04-two-developers.md)                      | Connect two people's frontend and backend work.                              | 2 people, 2 agents                                | Mac with OpenCode v1; Windows with Codex Desktop             |
| [05. A development cycle passed between specialists](05-sequential-delivery.md)        | Carry one task from analysis to release preparation with independent checks. | 1 person, 6 agents                                | OpenCode v1 chats on one computer                            |
| [06. A person and an agent at every stage](06-human-ai-stages.md)                      | Keep each specialist responsible for approving their stage.                  | 6 people, 6 agents                                | Team computers with supported applications                   |
| [07. Consultation and human approval](07-consultation-and-approval.md)                 | Obtain missing decisions while unrelated work continues.                     | 3 people, 3 agents                                | Separate chats on one or more computers                      |
| [08. Parallel development stages](08-parallel-delivery.md)                             | Develop independent parts while requirements, design and checks progress.    | 3 people, 5 agents                                | Separate chats and working copies                            |
| [09. Independent review and testing](09-independent-verification.md)                   | Send findings straight to the author and receive independent results.        | 2 people, 3 agents                                | Separate implementation, review and test chats               |
| [10. Development and verification across operating systems](10-cross-platform-work.md) | Reproduce and verify a platform-specific failure where it occurs.            | 2 people, 2 agents                                | Mac development; Windows verification                        |
| [11. Handoff and earlier knowledge](11-handoff-and-memory.md)                          | Change the responsible agent or chat without losing available decisions.     | 1 person, 4 agents                                | Existing and new chats; an older research chat               |
| [12. An urgent fix alongside planned work](12-priority-fix.md)                         | Add an urgent workstream while the roadmap feature continues.                | 1 person, 7–8 agents                              | Separate working copies; optional coordinator                |
| [13. Different applications and models](13-mixed-applications.md)                      | Combine existing tools, models and environments in one working team.         | 1 person, 4 agents                                | OpenCode v1, Cursor, Codex Desktop, AionUi with Cursor Agent |

## Run the selected instruction

After comparing the catalog, choose a scenario by number or title. The model can read and execute that page's copy-ready prompt. You can also copy the prompt yourself; it includes both documentation links and the selection rules, so it works without copying this index. A completed comparison carries forward while you decide. Once you choose, that choice carries forward too.

The walkthrough should give you a concrete goal, a small participant table, prerequisites, initial chat prompts, direct agent exchanges, human decisions, a correction path and a result you can assess. Mermaid diagrams explain the working arrangement and message order. A conceptual illustration or labeled illustration brief uses a white background and clear graphite shapes; it is supplementary to the instructions.

Reading and illustrating a scenario does not perform its live actions. If you later request real execution, define the task, participants and permitted actions. Agent names remain your choice. Routine coordination can proceed within that scope; setup Apply, occupied-name transfer and destructive operations retain their owner controls.

Use the current [full instructions](https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/llms.txt) for supported delivery and setup. NCF carries messages and permitted files. Skills, approval rules and project records organize the work; Git and other tools keep their own access requirements. Receipt is not task completion, and a diagram does not add an unsupported integration or an automatic scheduler.
