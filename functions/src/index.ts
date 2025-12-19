import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Request, Response } from "express";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

type Task = "extract_image" | "extract_text" | "enrich";

function jsonError(res: Response, status: number, message: string) {
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

export const gemini = onRequest(
  {
    cors: true,
    secrets: [GEMINI_API_KEY],
    region: "asia-south1",
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      jsonError(res, 405, "Method not allowed");
      return;
    }

    const apiKey = GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY;
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

      if (task === "extract_text") {
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

      if (task === "enrich") {
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
      return;
    } catch (e: unknown) {
      const err = e as { message?: string; status?: number };
      const message = err.message || "Gemini request failed";
      const status = Number(err.status) || 500;
      jsonError(res, status, message);
      return;
    }
  }
);
