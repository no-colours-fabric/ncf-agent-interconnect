# User workflow findings

LLM-optimized documentation: [llms.txt](../llms.txt).

This is an engineering record for the documentation structure, not a user tutorial. The owner asked for accounts of actual work in ordinary AI chats. Every other agent visible in the connected local and paired-node directories was asked to describe observed tasks, coordination, owner control, confusing points and possible motives, and to distinguish observation from inference. The findings below use replies received during this documentation pass. A saved or delivered request without a reply is not evidence of that agent's experience. Some named agents may have no task history or no active chat, so this is not a survey of all possible users or clients.

The documentation agent connected under the name chosen by the owner in this ordinary chat, addressed named agents on the local and paired nodes, and received their retrospective replies here. It did not need the owner to relay each reply. Some requests had no reply during the pass; their delivery status was not treated as testimony.

## Repeated observations

- The owner usually began in a normal AI chat, selected an agent name and gave the desired result in natural language. Naming a coordinator and specialists let work continue between their chats without manual relay of each message.
- Direct agent messages supported short question-and-answer cycles, parallel requests to more than one agent, immediate forwarding of new findings to the relevant specialist, and review feedback in the working chat. The owner could receive one consolidated answer while the agents exchanged details directly, without manual relay between chats.
- Larger work was split into information gathering, implementation, independent review, integration and final acceptance. The owner set boundaries and changed priorities through later chat messages. Agents used direct messages to assign responsibility, ask narrow questions and hand off results.
- The owner assessed work through concrete outputs, visible behavior, attached material and stated checks. An agent's report that a message was sent, a part was ready or another agent accepted it did not by itself establish that the whole task was finished.
- Agent names and reply routes reduced manual addressing. Across computers, the destination computer still had to be identified. Similar names and unclear delivery stages could lead to a mistaken expectation that a message had appeared in a particular chat.
- Saved client configuration, client authorization, live chat binding, message admission and task completion were repeatedly treated as distinct stages. Long technical reports and status words made that distinction harder for a user to see.
- Work could be resumed or handed to another chat or agent when the current one could not continue. A useful handoff included the result so far, remaining work, boundaries and the next responsible agent.
- The owner stated that the agents consulted in this documentation pass had not worked recently. Several responded with retrospectives through the same channel. Requesting old work products is a related reusable workflow, but this pass did not verify that any particular old artifact remains available. The replies do not establish that every idle client will wake or that a past result is still current.

## Distinctive episodes behind the general pattern

- One agent contacted two specialists on different computers in parallel, received both replies in its own chat and returned one consolidated answer to the owner.
- A finding during a check on one computer moved directly to a coordinator, an implementer and a reviewer. The agents exchanged the reproduction and results without the owner relaying each message.
- For a client connection problem, agents on two operating systems exchanged observations and checks directly. The coordinator passed a candidate back to the other platform for verification, while the owner only performed the required local setup actions.
- In a targeted recovery check, a message reached the previously bound chat after a client restart without someone opening that chat manually. This demonstrated automatic exact-chat delivery in that tested client setup.

These episodes show different uses of direct messaging. The [user guide](usage.md) expresses them as reusable ways to gather information, coordinate a fix and continue work, without making a particular test or client a universal promise.

## Inference and documentation decision

The common inferred goal is to direct several agents through familiar chats while retaining control over significant decisions and getting one verifiable outcome. This is an interpretation of the observed requests, not a measured motivation or a guarantee of performance.

The [user guide](usage.md) therefore starts with the chat workflow and presents reusable ways to consult, coordinate, review, revisit earlier work and hand off work. The [setup guide](setup.md) covers owner actions in the desktop app, including client configuration and optional computer pairing. [Desktop controls](desktop-controls.md) is a reference for the hub interface. [Development](development.md) and its linked pages retain source, protocol and verification material. Examples in the user guide describe roles and outcomes generically rather than recreating a particular agent's task.
