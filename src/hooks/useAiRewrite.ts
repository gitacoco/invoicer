export interface AiConfigPublic {
  provider: "minimax";
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

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

export async function saveAiConfig(apiKey: string): Promise<AiConfigPublic> {
  const res = await fetch("/__invoicer/ai-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "minimax", apiKey }),
  });
  const payload = await parseJsonSafe<AiConfigResponse>(res);
  if (!res.ok || !payload?.ok || !payload.config) {
    throw new Error(payload?.error || "Failed to save AI config.");
  }
  return payload.config;
}

export async function rewriteServiceText(text: string): Promise<string> {
  const res = await fetch("/__invoicer/ai-rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = await parseJsonSafe<RewriteResponse>(res);
  if (!res.ok || !payload?.ok || !payload.rewrittenText) {
    throw new Error(payload?.error || "AI rewrite failed.");
  }
  return payload.rewrittenText;
}
