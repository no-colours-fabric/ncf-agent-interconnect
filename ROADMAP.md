# Roadmap

A working notebook for ideas, requests, and deferred work on NCF Agent Interconnect. Entries may be incomplete or exploratory; they are not commitments.

## Conventions

- Give each new entry the next permanent ID: `R-0001`, `R-0002`, and so on. Never renumber or reuse IDs.
- Keep a short title in the heading. Revise the title as the idea becomes clearer; keep its ID.
- Write freely below the checkbox: observations, questions, alternatives, links, and evolving requirements may take as much space as needed.
- `- [ ]` means unfinished. Change it to `- [x]` only when the work is complete; add a brief outcome and a PR or release link when available.
- Separate entries with `---`. Add new entries at the end so numbering follows the order of capture.

## Adding an idea

1. The owner describes an idea. Ask at most one clarifying question if needed.
2. Restate the idea in clear, structured wording, preserving its intent and language. Add only minor details that do not conflict with it.
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

## R-0001 — Автоматическое обнаружение узлов для сопряжения

- [ ] Open

Упростить сопряжение нескольких узлов с помощью автоматического поиска в сети.

Ожидаемый сценарий:
1. Пользователь запускает приложение и видит обнаруженные активные узлы.
2. Выбирает нужный узел и нажимает кнопку «Сопрячь».
3. Приложение сразу предлагает ввести код сопряжения.
4. Пользователь может повторить эти действия для других узлов.

---
