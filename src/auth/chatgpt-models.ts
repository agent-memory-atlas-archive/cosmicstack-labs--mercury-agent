import type { ProviderModelCatalog } from '../utils/provider-models.js';
import { CHATGPT_BACKEND_API } from './chatgpt-session.js';

// Models available to ChatGPT Plus/Pro subscribers via OAuth.
// Sorted by preference (newest/best first).
// Only models supported on the ChatGPT codex/responses endpoint.
// IMPORTANT (2026-09): the codex backend validates the slug against the
// account's LIVE entitlements and rejects everything else with HTTP 400
// "The 'X' model is not supported when using Codex with a ChatGPT account."
// Plain dotted slugs only — hyphenated web-app slugs (gpt-5-6-thinking) and
// -thinking/-codex variants are NOT supported, and gpt-5.4*/gpt-5.3*/gpt-5.2
// have been dropped. The authoritative list comes from
// GET /backend-api/codex/models?client_version=1.0.0 (entitled for the plan).
const CHATGPT_PREFERRED_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.5',
  'gpt-6-astra',
  'gpt-5.6-luna',
] as const;

/**
 * Build headers for ChatGPT backend-api/codex requests (OAuth-based).
 */
export function getChatGPTHeaders(accessToken: string, accountId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'ChatGPT-Account-Id': accountId,
    'User-Agent': `mercury-agent/1.0 (${process.platform} ${process.arch})`,
  };
}

/**
 * Fetches the account's live-entitled Codex model slugs.
 *
 * Endpoint: GET /backend-api/codex/models?client_version=1.0.0 — this is the
 * list the codex/responses endpoint actually accepts for the account's plan.
 * Do NOT use /backend-api/models: that is the ChatGPT WEB-APP model list
 * (hyphenated slugs like `gpt-5-6-thinking`) which the codex/responses
 * endpoint rejects with HTTP 400 for every request.
 */
export async function fetchChatGPTModels(
  accessToken: string,
  accountId: string,
): Promise<ProviderModelCatalog> {
  try {
    const response = await fetch(`${CHATGPT_BACKEND_API}/codex/models?client_version=1.0.0`, {
      headers: getChatGPTHeaders(accessToken, accountId),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok) {
      const data = (await response.json()) as Record<string, any>;
      const models = (Array.isArray(data.models) ? data.models : [])
        .map((m: any) => (m.slug?.trim() ?? m.id?.trim() ?? '') as string)
        .filter((slug: string) => slug.length > 0);

      if (models.length > 0) {
        return buildCatalog(models);
      }
    }
  } catch {
    // Fall through to hardcoded list
  }

  // Fallback: return the known models for ChatGPT Plus/Pro
  return buildCatalog([...CHATGPT_PREFERRED_MODELS]);
}

function buildCatalog(models: string[]): ProviderModelCatalog {
  const preferredSet = new Set<string>(CHATGPT_PREFERRED_MODELS);

  // Pick the recommended model
  let recommendedModel = models[0]!;
  for (const preferred of CHATGPT_PREFERRED_MODELS) {
    if (models.includes(preferred)) {
      recommendedModel = preferred;
      break;
    }
  }

  // Prioritize preferred models, then the rest
  const preferredMatches = CHATGPT_PREFERRED_MODELS.filter((m) =>
    models.includes(m),
  ) as unknown as string[];
  const others = models
    .filter((m) => m !== recommendedModel && !preferredSet.has(m))
    .sort();

  const allModels = [
    ...preferredMatches.filter((m) => m !== recommendedModel),
    ...others,
  ].slice(0, 10);

  return {
    recommendedModel,
    models: allModels,
  };
}

export { CHATGPT_BACKEND_API };
