import { GoogleGenerativeAI } from "@google/generative-ai";

type ApiRequest = {
  method?: string;
  body?: Record<string, unknown>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
  end: () => void;
};

type Task = "extract_image" | "extract_text" | "enrich";

function setCors(res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function jsonError(res: ApiResponse, status: number, message: string) {
  res.status(status).json({ ok: false, error: message });
}

function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    jsonError(res, 405, "Method not allowed");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, "Gemini API key is not configured (GEMINI_API_KEY)");
    return;
  }

  const task = (req.body?.task as Task | undefined) || undefined;
  if (!task) {
    jsonError(res, 400, "Missing 'task'");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
  });

  try {
    if (task === "extract_image") {
      const prompt = String(req.body?.prompt || "");
      const base64Image = String(req.body?.base64Image || "");
      const mimeType = String(req.body?.mimeType || "image/png");
      if (!prompt) {
        jsonError(res, 400, "Missing 'prompt'");
        return;
      }
      if (!base64Image) {
        jsonError(res, 400, "Missing 'base64Image'");
        return;
      }

      const imagePart = { inlineData: { data: base64Image, mimeType } };
      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      const json = extractJsonObject(text);
      res.status(200).json({ ok: true, text, json });
      return;
    }

    if (task === "extract_text" || task === "enrich") {
      const prompt = String(req.body?.prompt || "");
      if (!prompt) {
        jsonError(res, 400, "Missing 'prompt'");
        return;
      }

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const json = extractJsonObject(text);
      res.status(200).json({ ok: true, text, json });
      return;
    }

    jsonError(res, 400, "Unsupported task");
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number };
    const message = err?.message ? String(err.message) : "Gemini request failed";
    const status = Number(err?.status) || 500;
    jsonError(res, status, message);
  }
}
