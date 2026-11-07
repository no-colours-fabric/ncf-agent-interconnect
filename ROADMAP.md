# Roadmap

A working notebook for ideas, requests, and deferred work on NCF Agent Interconnect. Entries may be incomplete or exploratory; they are not commitments.

## Conventions

- Write all roadmap entries in English, including ideas originally described in another language.
- Give each new entry the next permanent ID: `R-0001`, `R-0002`, and so on. Never renumber or reuse IDs.
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

- [ ] Open

Make pairing multiple nodes easier through automatic discovery on the network.

Expected flow:

1. The user launches the app and sees detected active nodes.
2. The user selects a node and clicks Pair.
3. The app immediately prompts for a pairing code.
4. The user can repeat these steps for other nodes.

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
