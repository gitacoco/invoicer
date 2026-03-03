export interface AiConfigPublic {
  provider: "minimax";
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.1-highspeed";
export const MINIMAX_MODEL_OPTIONS = [
  "MiniMax-M2.1-highspeed",
  "MiniMax-M2.1",
  "MiniMax-M2.5-highspeed",
  "MiniMax-M2.5",
  "MiniMax-M2",
] as const;

interface AiConfigResponse {
  ok: boolean;
  config?: AiConfigPublic;
  error?: string;
}

interface RewriteResponse {
  ok: boolean;
  rewrittenText?: string;
  error?: string;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAiConfig(): Promise<AiConfigPublic> {
  const res = await fetch("/__invoicer/ai-config");
  const payload = await parseJsonSafe<AiConfigResponse>(res);
  if (!res.ok || !payload?.ok || !payload.config) {
    throw new Error(payload?.error || "Failed to load AI config.");
  }
  return payload.config;
}

export async function fetchAiConfigSecret(): Promise<string> {
  const res = await fetch("/__invoicer/ai-config?includeSecret=1");
  const payload = await parseJsonSafe<AiConfigResponse>(res);
  if (!res.ok || !payload?.ok || !payload.config) {
    throw new Error(payload?.error || "Failed to load AI config.");
  }
  return payload.config.apiKey ?? "";
}

export async function saveAiConfig(
  apiKey: string,
  options?: { model?: string }
): Promise<AiConfigPublic> {
  const res = await fetch("/__invoicer/ai-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "minimax",
      apiKey,
      ...(options?.model ? { model: options.model } : {}),
    }),
  });
  const payload = await parseJsonSafe<AiConfigResponse>(res);
  if (!res.ok || !payload?.ok || !payload.config) {
    throw new Error(payload?.error || "Failed to save AI config.");
  }
  return payload.config;
}

export async function rewriteServiceText(
  text: string,
  options?: { signal?: AbortSignal }
): Promise<string> {
  const res = await fetch("/__invoicer/ai-rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: options?.signal,
  });
  const payload = await parseJsonSafe<RewriteResponse>(res);
  if (!res.ok || !payload?.ok || !payload.rewrittenText) {
    throw new Error(payload?.error || "AI rewrite failed.");
  }
  return payload.rewrittenText;
}
