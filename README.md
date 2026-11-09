# FreeLLMAPI workspace for Codex and Claude Code

To recreate this configuration on a new machine, follow the [restore guide](RESTORE.md).

This folder contains the standalone FreeLLMAPI gateway, coding launchers and private gateway state. **JobOS does not need to be running.** The same gateway can also be selected inside JobOS through its HTTP API. No JobOS server, source code or credential file is required for this app.

## Start here

Open this folder in VS Code, open a terminal, and run:

```powershell
cd C:\projects\freellmapi
npm.cmd start
```

Open the dashboard at <http://127.0.0.1:3001/>. Startup returns to the terminal because the gateway runs in the background. If it is already running, the command reuses it. If local Ollama is unavailable, the dashboard still starts so you can configure provider keys and use cloud model routes. Do not start another upstream server manually on the same port.

Open `data/gateway/private.json` **privately in your editor**. Use its `email` and `password` fields to log into the local dashboard. Its `apiKey` is the client key used by the launchers, not an upstream provider key. Never paste this file into chat or commit it.

## Use Codex or Claude Code

From this folder, choose one client:

```powershell
npm.cmd run codex
```

Or:

```powershell
npm.cmd run claude
```

Type your task into the launched session. Both commands start the gateway when needed; a selected local model also starts its configured installed Ollama service. Cloud models do not require Ollama. **Claude Code defaults to `auto:coding-quality`**: the gateway ranks eligible routes in a dedicated coding pool for the task and retries another eligible route on quota/provider failures before output starts. No model flag is needed. Codex retains its downloaded Ollama default (`local-ollama-jobos-coderlatest`).

For a task in another project, supply its real folder:

```powershell
npm.cmd run codex -- --cwd "C:\path\to\your-project"
npm.cmd run claude -- --cwd "C:\path\to\your-project"
```

Without `--cwd`, the client works in the current terminal folder. Run one client/model workflow at a time. Avoid running a local JobOS task at the same time as a local coding task on the same GPU. These standalone launchers do not query or depend on JobOS. Normal tool approvals remain enabled; no global Codex or Claude sign-in/provider configuration is overwritten. Claude's gateway state is separate under `data/gateway/claude-config`.

**Known limit:** the existing local 4B setup passed reply-only connections, but bounded file-edit and Codex file-read checks timed out. Autonomous coding remains experimental. The cause was not isolated between model, gateway translation and client/sandbox behavior. A connection reply does not establish working tool execution. Review and test any generated code. Anthropic does not officially support non-Claude models in Claude Code: [gateway documentation](https://code.claude.com/docs/en/llm-gateway). For Codex configuration/verification, see [official OpenAI documentation](https://learn.chatgpt.com/docs/enterprise/connect-to-a-gateway).

## Choose another provider/model

For the provider comparison checked on 5 November 2026, see [FREE-PROVIDERS-RESEARCH.md](FREE-PROVIDERS-RESEARCH.md). It distinguishes free coding endpoints, recurring allowances and trial credits.

1. Open the local dashboard and add an upstream key from your own provider account. The existing Gemini key was retained during relocation; available quota varies by account and reset window. No new cloud key or credit was created.
2. Run:

   ```powershell
   npm.cmd run models
   ```

3. Copy an available catalog model ID and launch with it:

   ```powershell
   npm.cmd run codex -- --model "EXACT_MODEL_ID" --cwd "C:\path\to\your-project"
   npm.cmd run claude -- --model "EXACT_MODEL_ID" --cwd "C:\path\to\your-project"
   ```

The gateway is a router, not a supply of unlimited cloud credits. Free tiers have provider/account quotas. Its catalog can also contain paid models; check the upstream account/model before choosing one. Claude selects the `auto:coding-quality` coding chain by default. Codex selects the general pool only with `--model auto`. Automatic routing uses your dashboard strategy (currently Smartest), code/chat signals, tool/context compatibility, observed reliability and available quota. It is a ranking heuristic, not a guarantee of the best answer. When a route hits a retryable quota/provider error before output, the router cools it down and tries the remaining eligible pool. If all usable routes are exhausted, it reports an error; it cannot remove upstream quotas. Mid-response failures may still need a client retry. Pinning a model limits fallback to providers serving that model. Cloud selections send coding prompts and included source/tool data to that upstream service.

## Claude automatic routing and the request-too-large message

From PowerShell, open Claude for JobOS without choosing a model:

```powershell
cd C:\projects\freellmapi
npm.cmd run claude -- --cwd "C:\projects\JOB"
```

The gateway starts in the background. The Claude model label is `auto:coding-quality`; check the dashboard's request/attempt history to see which upstream actually handled a turn. To stay on the downloaded local model, add `--model local-ollama-jobos-coderlatest`. Automatic coding routing can send prompts and included code/tool content to enabled routes in the `coding-quality` chain. Disable routes you do not want used in the dashboard; check account billing/free allowances there.

The coding pool uses a 131,072-token context and defaults output to 4,096 tokens. Explicit/local selections retain a conservative 32,768-token context unless you set `CLAUDE_CODE_MAX_CONTEXT_TOKENS`. Set `CLAUDE_CODE_MAX_OUTPUT_TOKENS` in your terminal to override the output allowance for a session; larger values can exclude small-context or low-TPM free routes. These are token limits, not request-body byte limits.

Claude can label a gateway HTTP 413 as "Request too large (max 32MB)" even when the body is small. A synthetic 54 KB request reproduced this with a pinned GPT-OSS route: the gateway returned `context_length_exceeded`, not a body-size rejection. The same client request with `auto` received HTTP 200 and the expected reply. Start a new Claude session after changing launcher defaults; old running sessions retain their selected model. If every enabled route has insufficient context/token allowance, compact the history or enable a suitable route. Raising the HTTP body limit does not fix that token error.

## Coding pool, tool use and long conversations

The default `auto:coding-quality` route uses Gemini 3.5 Flash and 3.6 Flash on Google, Muse Glimmer 30B on NVIDIA, and the explicitly free Dots3 Note Preview on OpenRouter. New installations select only enabled routes with a configured key, tools and at least 131,072 context tokens. The live profile includes all four. The gateway ranks eligible routes, so the serving order can vary. The NVIDIA and Google routes use their accounts’ available allowances. OpenRouter uses the exact `:free` ID. Provider account settings govern any billing.

Claude Code owns the conversation. On a retryable error before output starts, FreeLLMAPI retries the same request on an eligible route with the current messages, tool calls and tool results. Stay in the same Claude session and leave the model flag out. If an answer breaks after streaming has started, type `continue` in that session and have Claude check the last edit or test result before repeating it. Large histories can still be compacted, and if every route is unavailable you must wait. A provider handoff can change the quality of the answer, so have Claude run the failing test after it edits the code. Included conversation and file/tool contents can go to any enabled provider in this chain.

Start a **fresh** session from the repository you intend to work on. The interactive launcher prints the resolved Windows working folder and gateway route before Claude opens. For another repository under `project`, change to that sibling folder in PowerShell and run the same absolute launcher command. `Get-Location` shows your terminal's working directory immediately. For code review, ask for the Git commands and evidence that separate a working-tree change from a committed change.

Use a fresh Claude session after updating the launcher. Old sessions retain their old route and potentially degraded compacted history. More context postpones compaction; it does not remove provider quotas or eliminate model mistakes. Tool approvals stay enabled. The launcher defaults to a 90-second API timeout and zero additional client retries; the gateway already handles model failover. Explicit API_TIMEOUT_MS and CLAUDE_CODE_MAX_RETRIES environment values are preserved. This bounds repeated waits; it cannot make an unavailable provider respond.

Explicit `--model` choices are translated into a generated strict `pin-…` chain. This works around an installed Anthropic-adapter issue where some canonical catalog IDs silently use the general pool. Unknown IDs now stop the launcher instead. The generated chain contains only the selected model's catalog members; local endpoint IDs remain local. For an explicit model change, restart with `--model` rather than choosing a different catalog ID from Claude's in-session menu, which goes directly to the upstream adapter.

The earlier broad pool used raw Qwen 4B at a measured 4,096-token runtime context. Laguna and Nemotron Lightning produced incorrect audit findings. These routes are excluded from the coding chain. See [the verification record](CLAUDE-AUTO-TESTING.md) for actual model attribution and test limits.


## Switch to the downloaded laptop model

From the repository you want to work on, run the standard launcher for cloud routing with a laptop backup:

```powershell
node "C:\projects\freellmapi\scripts\code.js" claude
```

For local inference from the first turn, add `--local`. To pick up the most recent Claude conversation, exit the old session and use the same working folder:

```powershell
node "C:\projects\freellmapi\scripts\code.js" claude --local --continue
```

Drop `--continue` for a new conversation. Use `--resume` to select a specific session. The launcher prints the working directory and model route. Laptop mode sends inference directly to Ollama on `127.0.0.1:11434` and starts the installed local runtime if necessary. It needs the local Claude Code installation, and works with the FreeLLMAPI server stopped. Tools you choose to run can have network access independently of inference.

The backup uses the official [Qwen 3.5 4B weights](https://ollama.com/library/qwen3.5:4b) and an Ollama alias named `freellm-coder-128k:latest`. This machine reported **131,072 runtime context tokens**, about **7.5 GiB of model memory**, and **CPU inference**. Larger contexts require more memory and processing time. A near-full window can take substantially longer than the small coding tests. The model, file reads and tool output use local compute with no metered inference API.

To install or restore the model and enable automatic backup on this setup:

```powershell
cd "C:\projects\freellmapi"
node scripts/setup-laptop.js --enable-fallback
```

This checks the running context before enabling the backup. Start a new launcher process, optionally with `--continue`, for a changed setting to apply. The cloud gateway tries its eligible providers first. On quota errors, gateway connection failures during a request, and selected server errors before output, the launcher can send the current messages, tools and tool results to the laptop. It checks the input size and reserves space for the answer. If the history exceeds the local budget, compact it in the same session before retrying. A stream that already started is delivered once. If it breaks, ask Claude to continue and check the last edit or test result. Error-free but incorrect model answers still require tests or review.

For completely local inference, choose `--local` before starting sensitive work. The default launcher tries cloud providers on each new request, so later turns can send the conversation back to a cloud model even after a laptop fallback. The automatic backup applies to Claude launched through this script. For cloud routing without laptop backup, run `node scripts/setup-laptop.js --disable-fallback` and relaunch. The downloaded weights remain available.

## Use this gateway inside JobOS

Keep the gateway running and open <http://127.0.0.1:4317/#models>:

1. Click **Configure FreeLLMAPI**.
2. Enter `auto:coding-quality` in **Model** for automatic provider switching, or `local-ollama-jobos-coderlatest` for on-device processing.
3. Server: `http://127.0.0.1:3001/v1`.
4. Its gateway key is already saved in JobOS. Leave the password field blank to keep it.
5. Keep **Local SearXNG** (with Docker running) or a no-key public search source. Model choice and web retrieval are separate.
6. Click **Save AI settings**, **Test saved model**, then **Test live search**.
7. Use **Search now** for discovery/contacts/ranking, or **Analyze offer first / Tailor CV & email** for a saved offer.

To use a cloud model instead, paste its exact gateway catalog ID into the JobOS model field, save and test. Provider keys in JobOS's direct profiles and keys in the gateway dashboard are separate stores. JobOS's gateway client key authorizes the gateway; it does not create upstream credits. Searches remain manual, and email drafts remain unsent.

## Folder contents

```text
freellmapi/
  package.json         Local start/models/codex/claude/setup/test commands
  README.md            This guide
  source.json          Pinned upstream repository/revision
  lib/                 Gateway and launcher implementation; Node built-ins only
  scripts/             Command entry points
  test/                Isolated standalone tests
  upstream/            Actual downloaded FreeLLMAPI checkout and dependencies (ignored)
  data/
    gateway/           Database, encryption key, login, catalog and sessions (ignored)
    coding-tools/      Local Claude Code installation (ignored)
```

This is an independent sibling app beside JOB. The existing upstream checkout, gateway account/keys and coding packages were moved here, preserving their configuration. JobOS's original `gateway:*` commands still delegate to these launchers, and it uses the same port 3001. JobOS's application database, CV and direct-provider keys stay in JobOS.

Ollama is a separate local service on `127.0.0.1:11434`. This installation reuses the existing downloaded runtime/weights under the existing JOB/data/ollama installation, remembered by an absolute `ollamaRoot` in the private config. **It does not copy the multi-GB weights.** The standalone modules import no JobOS libraries or npm dependencies. You can use a normal installed Ollama service instead; once it is running, the launchers use it without needing those original files.

## Repair or use this folder elsewhere

Node.js 24 is required by this tested upstream revision. This workspace's public launcher files need no npm install. The upstream server/client and local Claude package have their own installed dependencies in the ignored folders.

Codex must already be installed on PATH; check with `codex --version`. Claude Code is installed locally in `data/coding-tools`. If Codex is missing, follow the official OpenAI installation instructions linked above before using its launcher.

If your Ollama installation is elsewhere, copy `.env.example` to `.env` and set the existing executable/model directory:

```dotenv
OLLAMA_EXECUTABLE=C:/path/to/ollama.exe
OLLAMA_MODELS=C:/path/to/ollama/models
```

Or start an installed Ollama service yourself. Keep the service loopback-only and use downloaded models. `npm.cmd run setup` registers local models and prepares the coding alias/catalog; it preserves the gateway account/database and does not change JobOS settings or start a search. On a fresh install, download a local base model such as `qwen3:4b` first.

If the ignored upstream checkout is missing, from this folder run:

```powershell
git clone https://github.com/tashfeenahmed/freellmapi.git upstream
git -C upstream checkout fb07845faf7cf986ea9f3692e055076035dd8739
cd upstream
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd rebuild better-sqlite3
npm.cmd run build
cd ..
npm.cmd install --prefix data/coding-tools --no-audit --no-fund @anthropic-ai/claude-code@2.1.318
npm.cmd run setup
npm.cmd start
```

If a moved checkout has broken npm workspace junctions, reinstall/build its dependencies at the new location. Do not delete the private gateway database/config to fix a dependency error. A copy of just the public Git files will not contain your private login, provider keys, installed packages or model weights; reinstall/restore them separately.

Back up `data/gateway` privately with its database and encryption key together. Do not delete `private.json` while retaining an encrypted database: that loses the key needed to decrypt stored provider credentials. Response caching is disabled in the managed gateway process; request metadata and coding-client session files can still be retained locally.

## Check it

```powershell
npm.cmd test
npm.cmd run codex -- --help
npm.cmd run claude -- --help
npm.cmd run models
```

Model listing is an authenticated catalog check, not a coding benchmark or guarantee of remaining upstream quota. For blocked job websites, use manual capture; changing coding clients cannot guarantee access.
