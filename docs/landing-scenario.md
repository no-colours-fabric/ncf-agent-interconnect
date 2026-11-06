# One developer, a growing project

LLM-optimized documentation: [llms.txt](../llms.txt).

Editorial scenario for a future landing page. This illustrative story combines workflows from the interviews; the reader is the only human participant.

You maintain an application people already use. You fix bugs, respond to user requests and develop roadmap features at the same time. More work keeps arriving, and each new request should not have to stop what is already underway.

You already use several AI services, choosing models and applications that suit your work and balancing costs. Some work happens in OpenCode, some in Codex or AionUi with Cursor Agent.

Your main workspace is a Mac, with a Windows computer available for checks in the environment your users run.[^workspace] In your main chat, you establish the coordination rules:

> Connect as agent Morgan. Use the `coordination` skill to coordinate all agents and keep track of the work as a whole. Send each participant your working rules. Coordinate work boundaries, Git branches, the order of implementation and integration, and conflict resolution. Put agents in touch when their work overlaps, arrange knowledge sharing, and keep them informed of relevant decisions and changes. Keep independent tasks moving in parallel. Bring me consolidated results and decisions that need my input.

AI agent Morgan coordinates all participants and follows progress across the project. Each new participant receives working instructions directly from the AI coordinator. You give each task its own chat. For the roadmap feature, you start a separate conversation:

> Connect as agent Leo. Use the `implementation` skill for task #T-1042: saved filters that let users reuse their search conditions. Morgan is the coordinator. Follow his instructions.

AI agent Leo, the developer, works on that feature. Later, two related user requests arrive. You give their analysis its own chat:

> Connect as agent Alice. Use the `analysis` skill to review issues #I-0201 and #I-0202. Check the existing search screen in Figma and identify the underlying user need. Morgan is the coordinator. Follow his instructions.

The participants already have working instructions and tools: skills with project conventions, test scenarios and contribution practices, plus access to relevant materials through MCP. AI agent Morgan supplies the task context, and each participant uses the resources already available in its environment.

The AI coordinator puts her in touch with the feature's owner. AI agent Alice discovers that both requests describe one need: users recreate identical search conditions every day. Her finding arrives directly in the chat where AI agent Leo is building saved filters. They clarify the behavior while the feature is still in development.

A user then reports an import failure on Windows. You open a chat on the Windows computer:

> Connect as agent Jade. Use the `verification` skill to reproduce bug #B-0317 with the attached import file. Morgan is the coordinator. Follow his instructions.

AI agent Jade, the tester, reproduces the bug and sends the details directly to the coordination chat. The user confirms that it blocks daily work.

You change the release priority:

> Release the fix for bug #B-0317 first. If task #T-1042 is not ready, it can follow in the next release. Keep that work moving.

For the fix, you connect another chat in an application you already use:

> Connect as agent Sam. Use the `implementation` skill to fix bug #B-0317. Morgan is the coordinator. Follow his instructions.

AI agent Sam takes ownership of the fix. AI agent Leo continues saved filters. AI agent Alice works on the requirements. AI agent Morgan shares the reproduction and arranges verification on Windows. The AI coordinator keeps the changes separate so the fix can ship first.

You remember another useful detail:

> Agent Oscar investigated import in task #T-0870. Ask for the previous decisions and examples relevant to bug #B-0317.

AI agent Oscar, the specialist from that earlier task, revisits the history available in his old chat. He shares the format constraints and examples he still has. AI agent Sam uses them in the fix. AI agent Jade adds the examples to the checks.

Questions, materials and results now travel directly between the participants. AI agent Jade sends an observation. AI agent Sam asks about the failure condition and passes a candidate back for verification. You do not need to carry messages between chats or approve each intermediate step.

When the fix is ready, AI agent Morgan returns a result to your original chat: what changed, what was checked and what is proposed for release. You assess whether it solves the user's problem and decide what to publish. Saved filters continue toward their own result.

Each task stayed with its assigned participant while the chats exchanged focused questions and useful findings. A chat can take on a different assignment later; in this story, new work gets its own participant. The team and release order changed while work was in progress. You contributed your knowledge of users and decided the priorities. The AI agents exchanged the working details, coordinated changes and checked the result.

[^workspace]: You can follow the same approach with one subscription and several chats in one supported application on a single computer. That computer can also host the required test environments, for example in virtual machines.
