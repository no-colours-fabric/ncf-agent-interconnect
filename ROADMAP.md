# Roadmap

A working notebook for ideas, requests, and deferred work on NCF Agent Interconnect. Entries may be incomplete or exploratory; they are not commitments.

## Conventions

- Write all roadmap entries in English, including ideas originally described in another language.
- Give each new entry the next permanent ID: `R-0001`, `R-0002`, and so on. Never renumber or reuse IDs, including IDs moved to issues.
- Track incidents and bugs in GitHub Issues. `R-0009` was moved to [issue #1](https://github.com/no-colours-fabric/ncf-agent-interconnect/issues/1).
- Keep a short title in the heading. Revise the title as the idea becomes clearer; keep its ID.
- Write freely below the checkbox: observations, questions, alternatives, links, and evolving requirements may take as much space as needed.
- `- [ ]` means unfinished. Change it to `- [x]` only when the work is complete; add a brief outcome and a PR or release link when available.
- Separate entries with `---`. Add new entries at the end so numbering follows the order of capture.

## Adding an idea

1. The owner describes an idea. Ask at most one clarifying question if needed.
2. Restate the idea in clear, structured English, preserving its intent. Add only minor details that do not conflict with it.
3. Show the proposed entry to the owner and request approval.
4. Add or revise the entry only after the owner explicitly approves it.

## Entry template

```markdown
## R-NNNN — Short title

- [ ] Open

Free-form notes, questions, and requirements.

---
```

The template is an example, not an entry. Replace R-NNNN with the next available ID.

## R-0001 — Automatic node discovery for pairing

- [x] Done — released in [v0.19.0](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/tag/v0.19.0).

Make pairing multiple nodes easier through automatic discovery on the network.

Expected flow:

1. The user launches the app and sees detected active nodes.
2. The user selects a node and clicks Pair.
3. The app immediately prompts for a pairing code.
4. The user can repeat these steps for other nodes.

Released outcome ([8c1cf91](https://github.com/no-colours-fabric/ncf-agent-interconnect/commit/8c1cf91720539dcdd3b80950030a8f47235609cd)): opening the window starts a bounded local IPv4 search. Results are grouped by claimed node ID and remain unverified until explicit pairing. The user can select an address and pair by code or enter an address manually. Verification covered isolated discovery and pairing regressions, network fixtures, and renderer UI. Native UDP discovery between two physical hosts was not run for this release.

---

## R-0002 — Long-term agent profile

- [ ] Open

Create an agent profile that retains important information gathered during work.

- As important information emerges, the agent periodically uses MCP to create, read, update, and delete profile records (CRUD).
- Clearing the agent's history does not reset the profile.
- The profile can be viewed and edited in the app.
- On connection, the agent receives its profile and instructions for maintaining it first.

Question to explore: whether the profile will require RAG.

---

## R-0003 — Skill catalog in the app

- [ ] Open

Store skills in the app in a catalog available to any agent.

The way to load skills from this catalog should be clearly distinct from the client's own skill-loading commands, so users and agents do not confuse the two mechanisms.

---

## R-0004 — Connect nodes through a central server

- [ ] Open

Create a central server that can connect all nodes instead of direct P2P connections.

---

## R-0005 — Support Microsoft Copilot

- [ ] Open

Add support for Microsoft Copilot as an NCF Agent Interconnect client, so a user can connect a Copilot conversation as an agent and exchange messages with agents in other supported clients.

Investigate the available integration methods, setup flow, and delivery limitations before defining the implementation.

---

## R-0006 — Headless service and TUI administration

- [ ] Open

Allow NCF Agent Interconnect to run without a graphical environment as a service.

Keep the current GUI, headless service, and terminal administration modes in one application. Select the mode through launch parameters:

- GUI mode: run the desktop interface as it works now.
- Service mode: run without a graphical interface.
- TUI mode: administer a running service from a terminal.

The service should remain running while a TUI session is used for administration.

---

## R-0007 — Discover installed AI applications

- [x] Done — released in [v0.18.5](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/tag/v0.18.5).

Detect supported AI applications installed on the user's computer.

- On the first launch after installing NCF Agent Interconnect, look for all supported applications.
- On later launches, detect newly installed supported applications and offer to configure them.
- Show the setup offer only once for each application.
- Display discovered applications as compact tiles with their official icons or logos.

Coverage: discovery checks known installation locations. Unsupported AppImage and unrecognized layouts remain unknown. Acceptance did not include a positive scan of an installed Windows client or a Linux GUI run.

---

## R-0008 — Distribute client adapters as plugins

- [ ] Open

Make client adapters plugins that can be developed independently of NCF Agent Interconnect and downloaded as packages.

One possible distribution model is a GitHub repository containing plugin packages. An npm registry is another option. The distribution model remains open for discussion.

---

## R-0010 — Listen on all network interfaces by default

- [x] Done — released in [v0.19.0](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/tag/v0.19.0).

By default, NCF Agent Interconnect listens on all eligible assigned local IPv4 addresses.

- The app updates its listeners automatically as eligible IPv4 addresses or interfaces appear or disappear.
- Network settings let the owner save exclusions for selected interfaces and view the actual enabled connection addresses.
- Exclusions apply to the app's peer listeners. MCP remains on `127.0.0.1`. IPv6 listener support is deferred.

Verification ([8c1cf91](https://github.com/no-colours-fabric/ncf-agent-interconnect/commit/8c1cf91720539dcdd3b80950030a8f47235609cd)) covered the IPv4 listener policy, isolated renderer behavior, closing excluded TLS sockets on loopback, and recovery through an alternate address with the existing peer identity and saved address preserved. Native interface changes, firewall behavior, and two-host LAN operation were not tested.

---

## R-0011 — Show sent and chat delivery times on incoming messages

- [x] Done — released in [v0.19.0](https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/tag/v0.19.0).

Show two timestamps in each incoming NCF Agent Interconnect message:

- **Sent:** the timestamp stored when the sender created the message.
- **Delivered:** when the receiving node prepares the message for its addressed chat adapter or for the current MCP read or history response.

Format both dates and times through seconds using the receiving app's locale and system time zone. Hide the time-zone offset.

```text
**Incoming NCF Agent Interconnect**
From: "<name>"
Sent: <localized date and time through seconds>
Delivered: <localized date and time through seconds>

<text>

Reply-To "<name>": <reply reference>
Use agent_send(connectionId, replyRef="<reply reference>", text) to reply.
```

Verification ([8c1cf91](https://github.com/no-colours-fabric/ncf-agent-interconnect/commit/8c1cf91720539dcdd3b80950030a8f47235609cd)) covered targeted source cases and packaged Incoming message fixtures on Apple Silicon and Windows x64. The timestamps describe message presentation. Receipt and task completion are tracked separately. Live delivery across all external clients, including OpenCode v2, was not verified.

---

## R-0012 — Plan release signing for target platforms

- [ ] Open

Prepare a developer signing and distribution-trust plan for NCF Agent Interconnect on all target operating systems after v0.19.0. This planning work does not block that release.

- macOS: identify Developer ID signing and notarization requirements.
- Windows: identify trusted code-signing and reputation requirements.
- Linux: define how to sign the actual AppImage or another selected distribution format.
- Record required accounts, certificates, release-process changes, and verification evidence for each platform before implementation.

The availability of developer accounts and certificates is not yet known. Planning does not include account registration, payments, or handling private keys.

---

## R-0013 — Approve a connection request on the receiving node

- [ ] Open

Provide two ways to complete a connection request: approval on the receiving node or entry of a pairing code.

1. On the requesting node, the existing Connect button opens the existing pairing-code dialog and sends a connection request.
2. The receiving node opens a separate window above other applications. It shows the requesting node's details and a Confirm button.
3. The code dialog shows an indicator when the request notification has been displayed to the receiving user.
4. If the receiving user confirms, the connection completes without entering a code. Alternatively, the receiving user can provide a pairing code, which the requesting user enters in the same dialog.

If the receiving window was closed, clicking Connect again opens it again. The receiving user can select **Don't show again** for that node; subsequent requests from it do not open the window. This setting is cleared if the user later connects that node through an explicitly provided pairing code.

Closing the window without confirmation does not establish a connection.

---

## R-0014 — Quick scenarios for everyday agent workflows

- [ ] Open

Create a dedicated documentation page with short, practical scenarios for NCF Agent Interconnect. For each scenario, show where to start, what to do, and how to verify the result. Link to detailed guides where needed.

- **Getting started:** Create an agent. Create several agents and coordinate them on one task.
- **Moving agents:** Move agents to new chats in the same application. Move an agent to a chat in another supported application. After a move, reconstruct the task context from the agent’s message history.
- **Connection and recovery:** Check whether an agent is connected. Restore an agent’s connection in different supported applications. Disconnect an agent from its chat.
- **History and diagnostics:** View an agent’s message history, clear it, or delete the agent. Explain what each action preserves or removes.
- **Other computers:** Pair a second computer and verify that the connection works.

Keep the list open to additional short scenarios.

---

## R-0016 — Clean up temporary attachment files

- [ ] Open

Add cleanup buttons for temporary files that agents create solely for transfer and for received copies of those files. Preserve user-created files, working files, and any file whose origin or purpose cannot be verified.

Keep message text, IDs, and attachment names in history. Mark removed attachments as unavailable and keep history pagination working, as specified in [issue #12](https://github.com/no-colours-fabric/ncf-agent-interconnect/issues/12).

When NCF Agent Interconnect cannot safely remove an agent’s temporary source file, MCP should instruct the agent to delete it once the transfer is verified and the file is no longer needed for a retry.

---

## R-0017 — Support larger attachments and verify transfers efficiently

- [ ] Open

Raise the default per-file attachment limit substantially. Add settings to set a custom limit or disable it. Users and agents should be able to send large files without splitting them into smaller parts.

Improve transfer and receipt verification to reduce redundant reads and checks. Preserve end-to-end integrity and report success only after the recipient has verified the complete file.

---
