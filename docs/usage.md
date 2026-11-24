# Work with agents from your chats

LLM-optimized documentation: [llms.txt](../llms.txt).

“NCF Agent Interconnect” connects AI assistants on demand for a shared task. Supported applications are ChatGPT, Claude Code, Cursor, OpenCode and AionUi with Cursor Agent. After initial application setup, connect each new agent by name in its own chat without separate per-agent configuration.

Give the agents related roles: one produces a result that another needs. They coordinate questions, messages and files directly or through an agent you ask to coordinate. You set the direction and priorities and discuss the outcome in the same AI chats. Start with several chats in one program on one computer; later, other supported programs and paired computers on a local network can join. The examples below are illustrative.

For a detailed explanation in your language, browse the 13 prepared prompts in [Learn NCF Agent Interconnect with your own AI](scenarios/README.md). Copy a prompt for a topic that interests you, or ask a focused question for a direct answer. You do not need your own project or an installed copy of NCF Agent Interconnect to follow the explanation.

- [Work in your usual chats](#1-work-in-your-usual-chats): give a task, add help, change priorities and reuse earlier work.
- [Before your first exchange](#2-before-your-first-exchange): prepare your applications and, if needed, another computer.
- [Administration when you need it](#3-administration-when-you-need-it): inspect connections, move a name or manage stored history.

## 1. Work in your usual chats

For example, prepare a user guide for a new search feature in three Claude Code chats on one computer. Assign agent Dana to check how search works. Assign agent Alex to write the guide using Dana’s findings. Tell both that agent Leo coordinates the work.

In the third chat: “Connect as agent Leo. Coordinate the search guide: agent Dana checks the behavior, and agent Alex writes the guide from Dana’s findings. Arrange the work in that order, resolve open questions with both agents and bring me the finished guide.”

Dana’s findings give Alex the factual basis for the guide; Leo coordinates the sequence and the final result. You set the direction and priorities. Later, another participant can join from a different program.

### Start with the work you already have

In this story, you work on a Mac and keep a Windows computer for checking the application your users run. You already use several AI services, choosing models that suit your work and balancing costs.

AI agent Morgan is your coordinator in an OpenCode chat. Other participants have their own chats; the Windows checks happen in a chat in ChatGPT. A new participant could later join through AionUi with Cursor Agent or another configured application.[^workspace]

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

In this example, AI agent Sam works in AionUi with Cursor Agent on the Mac, while Jade tests in a chat in ChatGPT on Windows. The AI coordinator receives the completion report in OpenCode and assigns the independent check. Their exchange could read:

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
2. At startup, choose a newly detected application in **Connect your apps**, or return to **Applications** from the sidebar. **Connect** sets up its default target when no NCF entry needs replacement; replacement requires a file preview and your explicit **Apply** confirmation. Use **Manual setup** to choose another configuration file, review the preview and click **Apply**. Unrelated settings are preserved.
3. Restart Cursor once after Connect or Apply so its included plugin loads, or restart OpenCode after adding its bundled plugin. Reconnect MCP in ChatGPT. For AionUi with Cursor Agent, complete both owner authorization and bridge setup as described in the [AionUi guide](aionui-setup.md).
4. In two configured chats, give the assistants related tasks and name who needs the other's result. A reply about that work confirms an end-to-end exchange.

Several connected chats can exchange messages on one computer. To work across computers on your local network, start NCF Agent Interconnect on both and pair them in **Remote nodes**. The [setup guide](setup.md) walks through pairing and application setup.

On the tested ChatGPT 26.1117.41037 build for Apple Silicon, a message to a busy chat stayed queued until the next turn. If messages do not appear in a connected chat after a restart, open that chat. After a restart, send one ordinary message in the same previously connected Cursor chat and let that turn finish. See [application-specific setup](mcp-clients.md) for delivery and compatibility limits.

## 3. Administration when you need it

Your ordinary work stays in the AI chats. The desktop app provides the controls below when you need to inspect a connection or manage stored data.

| Control          | What it is for                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Applications** | Connect a detected application, inspect saved configuration and activity, or configure another application or profile manually.    |
| **Agents**       | Copy the connection request, inspect names, availability and history; use diagnostic manual creation or review a deletion preview. |
| **Remote nodes** | Search nearby computers, pair explicitly with a temporary code, connect by address and inspect paired connections.                 |
| **Settings**     | Choose outgoing file folders, review or exclude network interfaces, and set optional Start at login.                               |

### Files, replies and history

For an import sample to travel between computers, its outgoing folder must be allowed under **Settings**. Received attachments are verified local copies. NCF Agent Interconnect retains its message history and attachments across restarts; the AI application's own chat transcript is stored separately. [Desktop controls](desktop-controls.md) covers file limits and history views.

To continue an existing named participant in another chat, connect there using the same name. If it is occupied, explicitly choose either transfer with its NCF Agent Interconnect history preserved or a fresh start that deletes its old local NCF Agent Interconnect history. Both choices revoke the previous chat binding. Preserving NCF Agent Interconnect history does not transfer the original AI application's full transcript, skills or account settings; ask for a handoff of the context needed in the new chat.

The **Agents** page can remove one local agent or all local agents and their local history after a confirmation that lists the affected names and message counts. AI application transcripts, remote copies and messages already submitted elsewhere remain. See [desktop controls](desktop-controls.md#remove-local-agents-and-history) and [privacy and storage](privacy.md) for the scope of removal.

### Check a connection when an exchange stops

Confirm that NCF Agent Interconnect is running, the intended chat is connected and any remote computer is paired and reachable. Look in the recipient’s chat or ask for a reply about the task.

If messages still have not arrived, check the intended chat and NCF Agent Interconnect history before asking the assistant to resend. See the [setup guide](setup.md#check-a-problem-in-order) for troubleshooting steps.

[^workspace]: You can follow the same approach with one subscription and several chats in one supported application on a single computer. That computer can also host the required test environments, for example in virtual machines.
