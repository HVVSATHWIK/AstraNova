type ProxyTask = "extract_image" | "extract_text" | "enrich";

export interface ProxyResponse {
    ok: boolean;
    text?: string;
    json?: unknown;
    error?: string;
}

const DEFAULT_ENDPOINT = "/api/gemini";

function getEndpoint(): string {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    const configured = env?.VITE_GEMINI_PROXY_URL;
    return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_ENDPOINT;
}

async function callGeminiProxy(body: Record<string, unknown>): Promise<ProxyResponse> {
    const endpoint = getEndpoint();
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = (await res.json().catch(() => null)) as ProxyResponse | null;
    if (!data) {
        const hint = endpoint === DEFAULT_ENDPOINT
            ? "Gemini proxy is not reachable. If you are using Firebase Hosting without Blaze, set VITE_GEMINI_PROXY_URL to a Vercel proxy (see README)."
            : "Gemini proxy is not reachable. Check VITE_GEMINI_PROXY_URL.";
        return { ok: false, error: `Gemini proxy returned non-JSON response (${res.status}). ${hint}` };
    }

    if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || `Gemini proxy failed (${res.status})` };
    }

    return data;
}

export async function geminiGenerateText(prompt: string): Promise<ProxyResponse> {
    return callGeminiProxy({ task: "extract_text" satisfies ProxyTask, prompt });
}

export async function geminiGenerateVision(prompt: string, base64Image: string, mimeType: string): Promise<ProxyResponse> {
    return callGeminiProxy({ task: "extract_image" satisfies ProxyTask, prompt, base64Image, mimeType });
}

export async function geminiEnrich(prompt: string): Promise<ProxyResponse> {
    return callGeminiProxy({ task: "enrich" satisfies ProxyTask, prompt });
}
