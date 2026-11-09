import {createHash} from 'node:crypto';

export const CLAUDE_PROFILE = 'coding-quality';
export const CLAUDE_ROUTE = `auto:${CLAUDE_PROFILE}`;
export const CLAUDE_CONTEXT_TOKENS = 131072;

// Deliberately small. Add a route after verifying real tool use and reviewing
// its answers, even when a new catalog model advertises a large context.
const approvedRoutes = [
  ['google', 'gemini-3.5-flash'],
  ['google', 'gemini-3.6-flash'],
  ['nvidia', 'meta/muse-glimmer-30b'],
  ['openrouter', 'dots-studio/dots-3-note-preview:free'],
];

export function selectCodingModels(models) {
  const selected = [];
  for (const [platform, modelId] of approvedRoutes) {
    const model = models.find(row => row.platform === platform && row.modelId === modelId
      && row.enabled && row.fallbackEnabled && row.supportsTools
      && row.contextWindow >= CLAUDE_CONTEXT_TOKENS && row.keyCount > 0);
    if (model) selected.push({ modelDbId: model.id, priority: selected.length, enabled: true });
  }
  return selected;
}

export async function ensureCodingProfile(request) {
  const [profiles, models] = await Promise.all([request('/api/profiles'), request('/api/models')]);
  const selected = selectCodingModels(models);
  const existing = profiles.find(profile => profile.name.toLowerCase() === CLAUDE_PROFILE);
  if (existing) {
    const rows = await request(`/api/profiles/${existing.id}/models`);
    const enabled = rows.filter(row => row.enabled);
    if (!enabled.length) throw new Error('The coding-quality chain is empty. Enable a supported coding model in the dashboard.');
    const approvedIds = new Set(selected.map(row => row.modelDbId));
    if (existing.auto_include_new_models || enabled.some(row => !approvedIds.has(row.model_db_id))) {
      throw new Error('Check the coding-quality chain before starting Claude. Disable automatic model additions and use only the approved Google, NVIDIA and OpenRouter coding routes listed in README.md with tools, an active key, and at least 131072 context tokens.');
    }
    return { id: existing.id, created: false, modelCount: enabled.length };
  }
  if (!selected.length) throw new Error('Enable an approved coding route from README.md in the active dashboard chain with a key, tool support and at least 131072 context tokens.');
  const profile = await request('/api/profiles', { method: 'POST', body: { name: CLAUDE_PROFILE, empty: true, emoji: '', color: '#2563eb' } });
  await request(`/api/profiles/${profile.id}/reorder`, { method: 'PUT', body: selected });
  return { id: profile.id, created: true, modelCount: selected.length };
}

export function pinMembers(model, rows) {
  // Use the gateway's own grouping, especially the endpoint-scoped IDs for
  // local Ollama. Guessing slugs or stripping providers can cross endpoints.
  const qualified = rows.filter(r => r.qualifiedModelId === model);
  const canonical = rows.filter(r => r.canonicalId === model);
  const native = rows.filter(r => r.modelId === model);
  const matches = qualified.length ? qualified : canonical.length ? canonical : native;
  if (!matches.length) throw new Error('Unknown gateway model ID. Run npm run models and choose an exact ID; no automatic fallback was used.');
  return [...new Set(matches.map(r => r.modelDbId))].sort((a,b)=>a-b);
}

export async function ensurePinnedProfile(model, request) {
  const ids = pinMembers(model, await request('/api/fallback'));
  const name = 'pin-' + createHash('sha256').update(model).digest('hex').slice(0,12);
  const profiles = await request('/api/profiles');
  let profile = profiles.find(p => p.name === name);
  if (!profile) profile = await request('/api/profiles', {method:'POST', body:{name,empty:true,emoji:'',color:'#64748b'}});
  const existing = await request(`/api/profiles/${profile.id}/models`);
  const active = existing.filter(r=>r.enabled).map(r=>r.model_db_id).sort((a,b)=>a-b);
  if (JSON.stringify(active)!==JSON.stringify(ids)) {
    await request(`/api/profiles/${profile.id}/reorder`, {method:'PUT',body:ids.map((modelDbId,priority)=>({modelDbId,priority,enabled:true}))});
  }
  // The installed Anthropic adapter silently treats some listed canonical
  // IDs as auto. A strict named chain avoids that behavior without a server
  // restart or changing the user's global fallback pool.
  return `auto:${name}`;
}
