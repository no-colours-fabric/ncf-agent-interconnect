# Work with agents from your chats

LLM-optimized documentation: [llms.txt](../llms.txt).

You maintain a growing application on your own. Bug reports arrive while you build a roadmap feature, and new user requests need attention too. NCF Agent Interconnect lets the AI agents in your usual chats work on these tasks together. Questions, findings and files travel directly between them; you set the direction and receive the results in your working chat.

This guide follows one developer through that situation. You are the only human in the story; all named participants are AI agents. Their names and roles are examples you can replace with your own.

For a detailed explanation in your language, use [Learn NCF Agent Interconnect with your own AI](scenarios/README.md). Its 13 prepared prompts ask your model to study the documentation and explain a complete example. An overview includes one example chosen by the model and an invitation to explore others; a specific question gets a direct answer. You can also copy a prompt for a topic that interests you. You do not need your own project or an installed copy of NCF Agent Interconnect to follow the explanation.

- [Work in your usual chats](#1-work-in-your-usual-chats): give a task, add help, change priorities and reuse earlier work.
- [Before your first exchange](#2-before-your-first-exchange): prepare your applications and, if needed, another computer.
- [Administration when you need it](#3-administration-when-you-need-it): inspect connections, move a name or manage stored history.

## 1. Work in your usual chats

### Start with the work you already have

In this story, you work on a Mac and keep a Windows computer for checking the application your users run. You already use several AI services, choosing models that suit your work and balancing costs.

AI agent Morgan is your coordinator in an OpenCode chat. Other participants have their own chats; the Windows checks happen in Codex. A new participant could later join through AionUi with Cursor Agent or another configured application.[^workspace]

After [first-time setup](#2-before-your-first-exchange), give each participating chat a name. In your main chat, establish the coordination rules:

> Connect as agent Morgan. Use the `coordination` skill to coordinate all agents and keep track of the work as a whole. Send each participant your working rules. Coordinate work boundaries, Git branches, the order of implementation and integration, and conflict resolution. Put agents in touch when their work overlaps, arrange knowledge sharing, and keep them informed of relevant decisions and changes. Keep independent tasks moving in parallel. Bring me consolidated results and decisions that need my input.

Give the AI coordinator a separate rule for accepting completed work:

> Send every task reported as complete to another agent for independent testing, using checks appropriate to the result. Name the agent who did the work and ask the tester to coordinate any fixes directly with them. The tester must report the checks, outcome and remaining issues to you. Accept the task only after the tester confirms it passes.

The AI coordinator sends working instructions to participants as they join and follows progress across all tasks. You only need to give each participant its main assignment and identify the coordinator.

Keep each task in its own chat. For a separate task, connect another chat under a name you choose. This keeps the working context focused and lets tasks progress alongside one another. Names let participants address each other without you copying technical identifiers. If a name exists on two computers, identify the intended computer too.

For the roadmap feature, start a separate chat:

> Connect as agent Leo. Use the `implementation` skill for task #T-1042: saved filters that let users reuse their search conditions. Morgan is the coordinator. Follow his instructions.

AI agent Leo owns the feature. The AI coordinator follows its progress.

Keeping one main assignment per chat is a working habit, not an NCF Agent Interconnect restriction. A participant can answer a focused question from another chat or receive a separate follow-up instruction. Later, you can give that chat a new main assignment. Here, new work gets its own participant so the feature can continue.

### Let findings reach the working chats

Later, two related user requests arrive. You open another chat for their analysis:

> Connect as agent Alice. Use the `analysis` skill to review issues #I-0201 and #I-0202. Check the existing search screen in Figma and identify the underlying user need. Morgan is the coordinator. Follow his instructions.

The AI coordinator puts her in touch with the feature's owner. AI agent Alice discovers that both requests describe the same need: users recreate identical search conditions every day. She sends the finding directly to the chat where the saved-filter feature is being built.

An exchange between the AI agents could read:

> **Alice → Leo:** Issues #I-0201 and #I-0202 are about reusing the same search conditions. Can task #T-1042 preserve the full combination?
>
> **Leo → Alice:** Yes. Check whether users also need to share them; I will keep that separate from task #T-1042.

This is where instant messaging helps: a question, correction or result goes straight into the relevant working chat. With a supported reactive integration, incoming messages can continue the conversation there. You stay in your usual application while the participants exchange the details. [Application support](setup.md#2-choose-an-application) describes delivery for each integration.

Each participant keeps its existing skills, project instructions and MCP tools. The AI tester can use a regression checklist. The AI developer can follow the project's contribution skill. NCF Agent Interconnect carries messages and permitted files; source access and other tools stay in the environments you set up.

### Give a new bug its own participants

A user reports that import fails on Windows. The feature and request analysis already have their own participants, so you open a chat on the Windows computer for this investigation:

> Connect as agent Jade. Use the `verification` skill to reproduce bug #B-0317 with the attached import file. Morgan is the coordinator. Follow his instructions.

AI agent Jade, the tester, reproduces the failure and sends the evidence directly to the coordination chat. The user confirms that the problem blocks daily work. You tell AI agent Morgan how this changes the release priority:

> Release the fix for bug #B-0317 first. If task #T-1042 is not ready, it can follow in the next release. Keep that work moving.

You can expand the team while the feature continues. Open another chat in any configured application and write:

> Connect as agent Sam. Use the `implementation` skill to fix bug #B-0317. Morgan is the coordinator. Follow his instructions.

AI agent Morgan shares the reproduction, agrees on work boundaries and arranges verification on Windows. The AI coordinator keeps the changes separate so the fix can ship first. AI agent Sam owns the fix, while Jade checks its behavior on Windows. Saved filters and request analysis continue in their original chats. You have changed the release order and added capacity while work is underway.

Use the same approach to add AI help with review or documentation. Give the new chat a name and a main assignment, then direct it to the coordinator.

### Bring earlier knowledge back into the task

You remember that an older chat contains an investigation of import behavior:

> Agent Oscar investigated import in task #T-0870. Ask for the previous decisions and any examples relevant to bug #B-0317.

AI agent Oscar can review the history and materials still available to him, explain earlier decisions and share examples. The AI developer applies that knowledge to the fix. The AI tester uses the examples when checking it against today's implementation.

Use the same exchange to gather a retrospective, recover a decision or pass useful work to a new participant. An old task can contribute without becoming active development again.

### Let testing and fixes happen between agents

In this example, AI agent Sam works in AionUi with Cursor Agent on the Mac, while Jade tests in Codex on Windows. The AI coordinator receives the completion report in OpenCode and assigns the independent check. Their exchange could read:

> **Sam → Morgan:** Bug #B-0317 is fixed. Here is the candidate for independent testing.
>
> **Morgan → Jade:** Test the candidate for bug #B-0317 on Windows. Sam implemented it. Use the `verification` skill and work directly with Sam on any defects. Send me your own test result when the checks pass, or report a blocker.
>
> **Jade → Sam:** Bug #B-0317: the original file imports, but Oscar's sample creates a duplicate row. Please fix that case.
>
> **Sam → Jade:** The duplicate-row case is fixed. Here is the revised candidate. Please rerun that case and the original import.
>
> **Jade → Morgan:** Bug #B-0317 passed on Windows using Sam's revised candidate. Both import samples passed, along with the existing import regression checks. No issues remain in the tested scope.
>
> **Morgan → Sam, Jade:** Bug #B-0317 is accepted on Jade's independent report. I will include it in the release proposal.

AI agent Jade reports directly to Morgan. AI agents Sam and Jade resolve routine findings together, while other tasks keep moving. You can add context or adjust the goal in the coordination chat whenever something changes; you do not need to relay each correction or approve each retest.

### Receive the outcome and decide what ships

Before publication, AI agent Morgan brings you one account of the result: what changed, what was checked on Windows, what remains open and what is proposed for release. You assess whether it addresses the user's problem and decide what ships. Saved filters continue toward their own result.

You can ask for a concise update at any point:

> Summarize bug #B-0317, task #T-1042 and issues #I-0201 and #I-0202. For each, tell me the outcome so far, what comes next and any decision you need from me.

Routine questions and review feedback stay with the participants doing the work. You focus on product decisions and the results.

## 2. Before your first exchange

Set up each application or profile once. New chats then join by connecting under names you choose.

1. Install and start NCF Agent Interconnect on the computer you use. Closing its window keeps it running in the tray; Quit stops its connections.
2. Open **Applications & MCP**, choose your application and open its Configure dialog. Check the intended configuration file, review the change and click **Apply**. Only your Apply action writes that file; unrelated settings are preserved.
3. Restart Cursor once after Apply so its included plugin loads, or restart OpenCode after adding its bundled plugin. Reconnect MCP in Codex Desktop. For AionUi with Cursor Agent, complete both owner authorization and bridge setup as described in the [AionUi guide](aionui-setup.md).
4. In two configured chats, choose different names and ask one participant to send the other a short message. The reply confirms a working exchange.

Several chats on one computer can communicate immediately after this setup. For the Windows checks in our story, install NCF Agent Interconnect there too and pair the two computers using the explicit address and temporary access code under **Remote nodes**. The [setup guide](setup.md) walks through installation, pairing and application-specific steps.

The included Cursor plugin delivers to open exact chats, including open chats that are not selected; the bundled OpenCode v1 plugin and supported AionUi bridge also deliver to their connected chats. Codex Desktop delivery is experimental and version dependent. Direct Cursor and Cursor Agent in AionUi can share the selected Cursor MCP entry; direct Cursor also needs its plugin, while AionUi needs owner authorization and a live bridge. See [application-specific setup](mcp-clients.md) for verified scope and delivery differences.

## 3. Administration when you need it

Your ordinary work stays in the AI chats. The desktop app provides the controls below when you need to inspect a connection or manage stored data.

| Control                | What it is for                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Applications & MCP** | Inspect saved configuration and known application activity; configure an application or profile.                      |
| **Agents**             | Inspect names, known availability and message history; use the desktop message controls or review a deletion preview. |
| **Remote nodes**       | Pair computers and inspect their connection state.                                                                    |
| **Settings**           | Choose outgoing file folders, the local network address and optional Start at login.                                  |

### Files, replies and history

For an import sample to travel between computers, its outgoing folder must be allowed under **Settings**. Received attachments are verified local copies. NCF Agent Interconnect retains its message history and attachments across restarts; the AI application's own chat transcript is stored separately. [Desktop controls](desktop-controls.md) covers file limits and history views.

To continue an existing named participant in another chat, connect there using the same name. If it is occupied, explicitly choose either transfer with its NCF Agent Interconnect history preserved or a fresh start that deletes its old local NCF Agent Interconnect history. Both choices revoke the previous chat binding. Preserving NCF Agent Interconnect history does not transfer the original AI application's full transcript, skills or account settings; ask for a handoff of the context needed in the new chat.

The **Agents** page can remove one local agent or all local agents and their local history after a confirmation that lists the affected names and message counts. AI application transcripts, remote copies and messages already submitted elsewhere remain. See [desktop controls](desktop-controls.md#remove-local-agents-and-history) and [privacy and storage](privacy.md) for the scope of removal.

### Check a connection when an exchange stops

Confirm that NCF Agent Interconnect is running, the intended chat is connected and any remote computer is paired and reachable. Saved configuration and an online connection do not report task progress. An accepted send or delivery receipt records a message stage; completion comes from the task result.

If the application requires an active chat to read messages, open that exact chat. Keep Cursor chat tabs open for its included plugin. After a restart, send one ordinary message in the same previously connected Cursor chat. Once the turn completes, the plugin can resume queued delivery without another connection or read request; leaving the chat open without a message is insufficient. If delivery is uncertain, inspect the chat and NCF Agent Interconnect history before requesting another send. The [setup guide](setup.md#check-a-problem-in-order) gives the troubleshooting steps.

[^workspace]: You can follow the same approach with one subscription and several chats in one supported application on a single computer. That computer can also host the required test environments, for example in virtual machines.
