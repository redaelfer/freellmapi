# FreeLLMAPI automatic Claude routing verification

## Downloaded laptop fallback

Installed official Qwen 3.5 4B using the existing Ollama runtime and created `freellm-coder-128k:latest` with a 131,072-token context. Ollama 0.40.3 reported 131,072 runtime tokens, 8,046,782,708 bytes of model memory and zero VRAM. The tiny native readiness request, including loading, took 9.85 seconds. This confirms allocation and CPU inference. Full-window retrieval accuracy and speed were not benchmarked.

The actual Claude launcher in `--local` mode ran a controlled debugging task in a disposable directory. A regression test with two assertions initially failed. The client called Bash, Read, Read, Edit and Bash. The independent final test returned exit 0, the original test file was byte-for-byte intact, the client reported the local model and 131,072 context tokens, and six turns took 205 seconds. This is one bounded coding task.

A temporary loopback server returned HTTP 429 while the production relay and real Ollama model handled a synthetic conversation containing a prior assistant tool call and its tool result. The result included a random marker known only from the tool result. The model recovered it after exactly one failed cloud attempt and one local inference. Tests also cover context overflow, local credentials, explicit pins, auth errors and an interrupted stream. A live listener check verified that requests without its session key returned 401 and dashboard endpoints returned 404. After enabling the backup, the normal Claude launcher completed a synthetic prompt on OpenRouter, confirming the cloud-first path. These probes supplied no CV, personal records or real project source. No jobs were searched.

The cloud provider chain, its own quota handling and the JobOS model selection are separate. The laptop fallback is per Claude process. Relaunch with `--continue` in the same directory to take the new configuration into an existing conversation. A fully local inference session uses `--local`. The full standalone suite has 23 tests.


## Claude debugging across provider quotas

The existing `auto:coding-quality` profile now includes Google Gemini 3.5 Flash, Google Gemini 3.6 Flash, NVIDIA Muse Glimmer 30B and OpenRouter Dots3 Note Preview using its explicit `:free` ID. Its four members were read back from the gateway. Only this named chain was updated. The launcher still respects removed or disabled members on later launches. Requests in this chain can send the current conversation and tool results to any enabled member. Dashboard rankings and available quota determine which eligible member serves a turn.

Request 179 recorded a Google 429 with one attempted Gemini 3.5 route. Both Google routes were enabled. There was no logged per-candidate exclusion reason for the unattempted model, and Google's message did not identify the quota window. The displayed reset estimate comes from the gateway's soonest local cooldown. A later synthetic call through the normal launcher succeeded on Gemini 3.6 (180).

Two live Claude CLI exercises used disposable files. Muse Glimmer used Read, recovered the random evidence marker and correctly computed the expected and actual prices (181–182). Dots3's initial debugging run exhausted its turn budget when a fixture guard denied basic directory listings. Once the guard allowed safe directory orientation, Dots3 issued Bash, Read, Read, Edit and Bash. An independent run of the same two assertions failed before and passed after the implementation edit. The test file was identical (192–196). This live debugging run stayed on one provider.

In the separate app, `node scripts/verify-context-handoff.mjs` starts the installed gateway on a temporary loopback port using an in-memory database, synthetic credentials and provider doubles. Provider A requests a tool. Its next streaming request fails with a forced 429 before output. The real gateway routes that request to B, which receives the identical translated message array, including the system instruction, original user ticket, assistant tool call ID and matching tool result. Exactly one response stream starts for the retried request. This test passed separately from the live debugging run. A provider failure after output starts can still require asking Claude to continue in the same session. Context limits, compaction, provider availability and model reasoning still apply.

All 17 standalone tests and both project syntax checks passed.

## Earlier Google-only quality chain (6 November 2026)

The launcher defaults to `auto:coding-quality`. The live named chain contains Google Gemini 3.5 Flash and 3.6 Flash. Both catalog entries advertise tools and 1,048,576 tokens. The launcher gives Claude a 131,072-token window, checks approved models and blocks unexpected additions at startup. The general gateway profile remained Default. JobOS can select this chain explicitly.

A two-turn disposable `project/JOB` fixture reproduced the path question and folder clarification. Gateway requests 153–155 all went to Google Gemini 3.6 Flash. Claude gave the correct working folder after one attempted Bash call, then acknowledged the scope with no tool call. A test-only hook denied tool execution. The fixture stayed empty, and both turns reported 131,072 context tokens. This tests the path exchange with that route. The earlier six-turn synthetic Git audit through Gemini 3.5 Flash correctly reported the counts and arithmetic bug. Under the older pool, OpenRouter Nemotron Lightning conflated the working tree and the local commit. An eight-turn audit was incorrect, and a twelve-turn retry also made this attribution error and hit its watchdog. Recent gateway records include raw local Qwen 4B requests lasting roughly three to eight minutes. The model responsible for any particular line of the user's pasted transcript could not be proved from that alone.

Seventeen standalone tests, nine JobOS bridge tests and both syntax checks passed for the quality update. The previous 58 targeted upstream protocol/routing checks and the strict launcher workaround for canonical model pins are recorded in JobOS TESTING.md. Use the serving model in the gateway history when assessing an answer.

The follow-up Git test on the two-model chain ended on HTTP 429 after six successful requests. The gateway tried both approved Gemini routes and reported quota exhaustion. No complete audit was returned.

Two additional enabled routes were tested separately through explicit strict pins. OpenRouter Dots3 Note Preview completed six turns, found the uncommitted rebate bug and the 1/1 divergence, but cited line 3 instead of 2 and described remote.txt as deleted rather than added on the remote. The Groq Qwen3.8 27B route returned the client's request-size error before using tools. Both remain outside the quality chain. Losing both Google routes therefore makes the quality route temporarily unavailable.

## Earlier Claude automatic model routing — 2026-11-05

The separate app's Claude launcher now defaults to gateway `auto` for the main model and background family aliases; explicit model pins still work. Codex retains its saved local default. Claude's output allowance defaults to 4,096 tokens, preserving an explicit environment override, while its conservative context remains 32,768 tokens. Credentials stay in the child environment, existing tool approvals remain enabled, and JobOS's saved provider/model is not changed. No application interface changed, so no new browser layout check was needed.

Standalone tests cover the new client-specific default, explicit pins/output overrides, auth isolation and argument parsing. The 99 isolated upstream checks cover the Anthropic wire/tool translation, quota exhaustion, automatic cross-model failover, shared cooldown/retry loop and code/chat routing. These tests use synthetic/mocked providers, not account credentials or CV/job data.

A real Claude CLI synthetic request reproduced the screenshot's misleading "max 32MB" message with a 54,075-byte body: the gateway returned HTTP 413 `context_length_exceeded` for the pinned GPT-OSS route. Its context/token allowance gate rejected the request; the body-size parser was not responsible. Reducing output alone did not make that pinned route eligible. The same client request through `auto` returned HTTP 200 and the exact requested marker. No HTTP body ceiling was increased.

The actual updated launcher was then invoked without `--model` in a disposable folder containing only a generated text fixture. It returned the fixture's random marker, establishing a real file read. Gateway request 35's attempt history shows a rate-limited Z.ai `glm-4.7-flash` attempt followed by a successful Google `gemini-3.6-flash` attempt. This is live quota-fallback evidence, not only a synthetic 429 test.

The file-edit part of that bounded probe was denied by Claude's normal permissions and the fixture remained unchanged. Its 65-second watchdog was reached; the captured client result was exit 0 after three turns, with the expected read marker and an `Edit` permission denial. Do not describe this as successful file-edit or arbitrary autonomous-coding validation. No permission check was bypassed. Earlier local 4B coding limitations remain documented below.

Automatic ranking is a heuristic over enabled/configured eligible routes. Provider availability, context/TPM allowances and free quotas still constrain it; an exhausted pool returns an error, and mid-response failures may require a retry. Non-Claude-model Claude Code compatibility remains experimental. No CV, candidate details or application records were used by these probes, no provider keys were edited, and no outreach or job search was run. Sanitized probe summaries and test output are in ignored `test-results/claude-auto-*` files. The separate app's README and the JobOS bridge guide now document the new command and limitations.
