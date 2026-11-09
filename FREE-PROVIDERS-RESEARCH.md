# Free API providers to add to FreeLLMAPI

Checked: 5 November 2026 (Africa/Casablanca).

## Recommendation for this workspace

Add **NVIDIA NIM first for personal coding experiments**, then **Cloudflare Workers AI for a clearly defined daily free allowance**. Consider **Z.ai's specifically free Flash models** as another lightweight option. This ranking is my assessment of published access, coding/tool features and fit with the installed gateway; it is not an account-level performance benchmark.

You already have Ollama, Google AI Studio, Groq and OpenRouter. This report evaluates additional services rather than treating those existing accounts as newly available capacity.

## How I checked

I opened current provider documentation and model pages, compared their live text with search summaries, and inspected the installed FreeLLMAPI adapters/UI. Cached summaries sometimes described offers differently from the fetched page. I favored the fetched primary page. I did not create accounts, generate keys, use your cloud inference quota, send a CV or run jobs searches. Signup eligibility, actual account quotas and end-to-end coding tools remain untested for these new providers.

## Comparison

| Provider | Current access evidence | Assessment for your use |
| --- | --- | --- |
| NVIDIA NIM | Developer-program hosted endpoints are available for prototyping; specific current model pages show free availability. | First additional provider to evaluate for coding. Free evaluation access is not a promise of unrestricted production service. |
| Cloudflare Workers AI | Daily free allowance of 10,000 neurons, with some models excluded from the Free plan. | Best-defined recurring free budget among the additions reviewed; useful for controlled app experiments. |
| Z.ai | Published pricing lists glm-4.7-flash and glm-4.5-flash at zero input/output price. | Useful additional free model pool; check authenticated rate limits and account eligibility. |
| Cohere | Evaluation keys have 1,000 calls/month, and listed chat models have 20 requests/minute. | Clear evaluation allowance; a coding agent can consume it quickly. |
| Cerebras | Support confirms Personal-account free usage; the coding product currently advertises limited free trial credits. | Conditional backup, not my main recommendation for a recurring free coding service. |
| AMD Radeon Cloud Token Factory | Free development service with daily point limits, on its China site only. | Technically interesting, but signup/access from Morocco and the account allowance were not established. |
| Mistral | Current usage documentation says Free mode excludes API access; API use requires billing activation. | Excluded from the confirmed zero-payment API shortlist. |
| Hugging Face Inference Providers | Current pricing lists no included credits for Free accounts. | Excluded from the confirmed zero-payment API shortlist. |
| OVHcloud AI Endpoints | Free model testing is advertised alongside token-billed service. | Evaluation option; I did not establish a recurring free authenticated API allowance. |

Provider-specific sources and qualifications follow.

## 1. NVIDIA NIM: recommended first for coding evaluation

NVIDIA's FAQ permits developer-program access to hosted endpoints for prototyping. Membership is free; production deployment has separate requirements. I did not establish one universal current request/minute limit, so check the model/account dashboard rather than assuming a fixed quota. No local GPU is needed to call a hosted endpoint. [NVIDIA FAQ](https://docs.api.nvidia.com/nim/docs/product)

Two current candidates:

- **minimaxai/minimax-m3.1-flash**: its hosted page lists a free endpoint as available, describes coding/agent use, and advertises 262K hosted context. This is my first model to evaluate for coding. [Current model page](https://build.nvidia.com/minimaxai/minimax-m3.1-flash)
- **nvidia/nemotron-3.5-super-vl-120b-a12b**: its page also lists free hosted availability and 262K context. Its API reference explicitly documents tools, tool choice, tool-result messages and structured output. [Model page](https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b), [API reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-super-vl-120b-a12b-infer)

These are hosted-service specifications, not a guarantee that every account can use the full window or that a coding client's tool loop will work through this gateway. No comparative speed/quality benchmark was run.

Older lists need care: NVIDIA now marks the free endpoints for **MiniMax M2.7**, **Qwen3-Coder-480B** and the original **DeepSeek V4 Flash** as deprecated, although partner/self-hosted options remain. Do not choose them merely because an old free-API list recommends them. [M2.7](https://build.nvidia.com/minimaxai/minimax-m2.7), [Qwen3-Coder](https://build.nvidia.com/qwen/qwen3-coder-480b-a35b-instruct), [DeepSeek V4 Flash](https://build.nvidia.com/deepseek-ai/deepseek-v4-flash)

## 2. Cloudflare Workers AI: predictable daily free budget

Workers Free includes **10,000 neurons/day**, resetting at 00:00 UTC (01:00 Casablanca on the report date). Neurons are compute-metering units, not requests or tokens. Model choice, prompt length, reasoning and output length determine how far that allowance goes. Some larger models explicitly require a paid plan or prepaid gateway credits. [Pricing and exclusions](https://developers.cloudflare.com/workers-ai/platform/pricing/)

A sensible starting candidate is **@cf/zai-org/glm-4.7-flash**. Its page specifies 131,072 context tokens, function calling and reasoning. It is a more practical candidate for the free allocation than a model on the paid-only list. Actual task quality and gateway compatibility still need testing. [GLM-4.7-Flash model card](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)

The installed FreeLLMAPI adapter supports Cloudflare; its key form asks for the account ID and API token. This is slightly more setup than a single-key provider.

## 3. Z.ai: specifically free models, separate from its paid coding plan

The current price table lists **glm-4.7-flash** and **glm-4.5-flash** as free. **glm-4.7-flashx** and the newer flagship models are priced separately. A free cache-storage column on a paid model does not make its inference free. [Official pricing](https://docs.z.ai/guides/overview/pricing)

Create a **Standard API key** in the global console and choose the exact free model. Its dedicated GLM Coding Plan is a separate offering. Published rate-limit navigation redirects into an authenticated account page, so I could not verify your quota or a universal free concurrency limit. [Quickstart](https://docs.z.ai/guides/overview/quick-start), [Account limits](https://z.ai/manage-apikey/rate-limits)

The installed gateway has a Zhipu AI/Z.ai adapter that can validate domestic and global key namespaces separately. A key from z.ai is not interchangeable with a bigmodel.cn key.

## 4. Cohere: a clearly limited evaluation option

Cohere's evaluation keys are free and capped at **1,000 calls/month**. Its current table lists **20 chat requests/minute**, including North Mini Code. Production keys are a separate paid category. This is worth considering for bounded evaluation, but a multi-step agent consumes several calls per task. [Official limits](https://docs.cohere.com/v2/docs/rate-limits)

The gateway has a native Cohere adapter. I did not verify which of its currently listed models your future evaluation account would enable.

## 5. Cerebras: refine the earlier recommendation

The support FAQ still says free usage and keys are available under Personal accounts, separately from Team/PayGo. [Account distinction](https://support.cerebras.net/articles/5041581099-cerebras-self-serve-paygo-faq)

However, the live coding page describes **limited free trial credits** for GLM-4.7. Its paid Pro/Max options are marked sold out. This corrects my earlier commentary based on a stale search summary: it is not evidence of a generally available, recurring free coding subscription. [Current coding offer](https://www.cerebras.ai/code)

Old pricing snippets with historical free context/throughput values were not used as current account guarantees. Check the actual Personal account's model, context and quota before considering it a dependable coding fallback.

## Other candidates checked

- **AMD Radeon Cloud Token Factory:** its own documentation describes an OpenAI-compatible free development service, a daily points allowance and account/key rate limits. It is China-site-only and not intended for production. Morocco signup/phone access and the actual account allowance remain unverified. I would not prioritize it over NVIDIA/Cloudflare without confirming access. [Documentation](https://amd-aim.github.io/radeon-cloud-docs/guides/token-factory/)
- **Mistral:** fetched current usage documentation says API access requires billing activation/pay-as-you-go. This supersedes older snippets advertising free API mode for this comparison. A free web/chat/Studio budget is not sufficient evidence of free API calls. [Current usage policy](https://docs.mistral.ai/admin/billing-usage/usage-limits)
- **Hugging Face:** the current pricing table lists **None** for included credits on Free accounts, despite older search summaries still showing $0.10/month. I would not add it expecting recurring free hosted inference. [Current pricing](https://huggingface.co/docs/inference-providers/en/pricing)
- **OVHcloud:** the product page advertises free testing but describes its main API as token-billed. I did not verify a recurring free authenticated quota; treat it as an evaluation candidate rather than assured permanent capacity. [Product page](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/)

## Add NVIDIA to your existing gateway

1. Open the current MiniMax or Nemotron model page linked above. Sign in/register for the NVIDIA Developer Program and use the page's **Generate API Key** action.
2. In your local FreeLLMAPI dashboard, open **Keys → Add key → Provider key → NVIDIA**. Paste the key there and save. Do not put an upstream key into the gateway client-key field.
3. Open the model list and inspect what is actually enabled. During this inspection, the gateway's loaded catalog did not contain the two newer NVIDIA model IDs above.
4. If needed, use the NVIDIA provider menu's **Add Custom Model** action, enter the exact upstream model ID from its current official page, and save it. This action is present in your installed UI. Model capability checkboxes describe routing metadata; they do not add capabilities.
5. Test one model first, then run **npm.cmd run models** from the freellmapi folder. Use the resulting gateway catalog ID when launching a client.

```powershell
cd C:\Users\ROG\Pictures\ensias\project\freellmapi
npm.cmd run models
npm.cmd run codex -- --model "GATEWAY_MODEL_ID" --cwd "C:\path\to\your-project"
# Or choose Claude Code:
npm.cmd run claude -- --model "GATEWAY_MODEL_ID" --cwd "C:\path\to\your-project"
```

Adding a provider key does not change these launchers' pinned local default. Select the desired gateway model explicitly. No new account/key has been created or tested as part of this research.

## Important limits in this installation

- Both coding launchers currently configure a **32,768-token context**. A provider advertising 131K/262K/1M does not automatically increase that client setting. Capability/context metadata should be adjusted only after checking the selected endpoint and account.
- Reply-only tests are insufficient. After adding a key, validate a JSON response and a full disposable-folder loop: read a synthetic file, make one edit, run its small test, and receive the final answer. Keep it bounded and sequential.
- The existing local 4B setup did not complete earlier bounded file-tool checks. This report does not claim that a new provider has already fixed them.
- The installed gateway already supports NVIDIA, Cloudflare, Z.ai/Zhipu, Cerebras, Cohere, Mistral, Hugging Face, AMD and OVH adapters. Adapter support does not establish current free entitlement, model availability, correct catalog IDs or tool reliability.
- The Claude-named compatibility slots in the gateway can route to other models. They do not establish access to proprietary Claude models.

## Verification record

Research and local source/catalog inspection only. No provider/profile default was changed, no package was installed, no cloud inference request or job-search workflow was started, and no private candidate content was read for this comparison. Linked current pages were checked rather than relying on unopened search summaries. Account signup, country eligibility, remaining quota and actual coding performance were not independently established.
