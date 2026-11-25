# Legacy IPC on macOS Apple Silicon

24 November 2026. The OpenAI stable macOS archive lists 26.1111.21308, 26.1111.71025 and 26.1111.71704, followed immediately by 26.1117.31558. Version 26.1111.71704 was published on 18 November at 22:41 UTC (19 November at 01:41 in Moscow).

The downloaded ZIP matched the feed's 835,851,598-byte length and passed its CRC check. macOS codesign verified the extracted bundle's strict signature. Its identifier was com.openai.codex, its build was 29030, and its signing team matched the installed app (2DC432GLL2). The app ran with isolated application data and a temporary Codex home.

The archived desktop started its legacy IPC listener. Initialization with the NCF Agent Interconnect 0.19.0 read-only client identity returned success and a client ID. The bundle contains both thread-follower-steer-turn and thread-follower-start-turn.

A temporary local provider prepared a scratch chat. The unchanged NCF adapter from v0.19.0 could not confirm that the desktop owned that specific chat before timeout. No message was submitted. Delivery to an active turn and browser operation on this build were not verified in this test. The test desktop was closed.

The owner separately reported successful thread-follower-steer-turn on Windows 26.1111.2228.0. No Windows runtime test was performed here.

[OpenAI macOS update feed](https://persistent.oaistatic.com/codex-app-prod/appcast-26.1117.41037.xml)
