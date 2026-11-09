# Restore the coding workspace

This repository contains a standalone Windows launcher for Claude Code and Codex. It uses the FreeLLMAPI gateway pinned in [source.json](source.json). The upstream checkout lives in `upstream/` on each machine.

1. Clone this repository into its own folder. With Node.js 24, follow [Repair or use this folder elsewhere](README.md#repair-or-use-this-folder-elsewhere) to install the pinned upstream gateway, Claude Code and a local Ollama base model. Run `npm.cmd run setup`, then open the local dashboard at `http://127.0.0.1:3001/`.
2. Add your provider keys in the dashboard. The saved dashboard profile was **Default** and the routing strategy was **Smartest**. Enable the coding models you have access to. The Claude launcher creates the separate `coding-quality` profile on first use using the eligible models in [coding-profile.js](lib/coding-profile.js).
3. To restore the enabled laptop backup, run `node scripts/setup-laptop.js --enable-fallback`. This prepares the downloaded Qwen model and checks its configured context before enabling it. Runtime files, downloads, keys and saved conversations live on each machine.

| Coding profile member | Provider |
| --- | --- |
| `gemini-3.5-flash` | Google |
| `gemini-3.6-flash` | Google |
| `meta/muse-glimmer-30b` | NVIDIA |
| `dots-studio/dots-3-note-preview:free` | OpenRouter |

The automatic Claude route is `auto:coding-quality` with a 131,072-token window. The laptop fallback uses `freellm-coder-128k:latest`. Provider quotas and gateway availability determine which model handles a given request.

From this checkout, launch Claude for a project or resume its most recent saved conversation:

```powershell
node .\scripts\code.js claude --cwd "C:\path\to\project" --permission-mode manual
node .\scripts\code.js claude --cwd "C:\path\to\project" --permission-mode manual --continue
```

Project instructions belong in the target repository's `CLAUDE.md`. Project skills go in `.claude/skills/<name>/SKILL.md`. The [npm permissions example](examples/claude-project-settings.json) is for a project with a `frontend/` directory. Merge the commands you want into that project's `.claude/settings.json`.

For auto mode on these providers, the optional PowerShell setting below uses Claude Code's client-side classifier for the current shell. Its requests use provider quota. The setting was verified for one session and is optional. See [Anthropic's guide](https://code.claude.com/docs/en/auto-mode-classifier-billing).

```powershell
$env:CLAUDE_CODE_AUTO_MODE_SERVER = '0'
node .\scripts\code.js claude --cwd "C:\path\to\project" --permission-mode auto
```

Run `npm.cmd test` and `npm.cmd run check` for the local checks. After setting up the gateway, `node scripts/verify-claude-npm.mjs` runs a real Claude session against a disposable project with an offline dependency and the permissions example. `node scripts/verify-claude-capabilities.mjs --plan` tests a local MCP tool in plan mode. Running the latter without `--plan` probes auto mode and reports any denials or retries. These live checks use the configured model route.
