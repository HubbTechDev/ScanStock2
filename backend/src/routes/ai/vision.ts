import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// A strict, parseable schema we can trust
type VisionResult = { label: string; count: number; confidence?: number };

export async function detectAndCountItemsFromImage(params: {
  publicBaseUrl: string;   // e.g. http://localhost:3334
  imageUrl: string;        // e.g. /uploads/xxx.jpg
}): Promise<VisionResult[]> {
  const { publicBaseUrl, imageUrl } = params;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const fullUrl = `${publicBaseUrl}${imageUrl}`;

  // Ask for JSON only; be explicit about counting + mixed items.
  const prompt = `
You are an inventory assistant.
Analyze the image and return a JSON array of objects with:
- label: short noun phrase (singular), like "t-shirt", "toy car"
- count: integer >= 1
- confidence: number 0..1 (optional but preferred)

Rules:
- Group identical items under the same label.
- If unsure, still guess with lower confidence.
- Do not include extra keys. Output JSON only.
`;

  const resp = await client.responses.create({
    model: "gpt-4.1-mini", // good cost/perf; we can upgrade later
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: fullUrl },
        ],
      },
    ],
  });

  const text = resp.output_text?.trim() ?? "";

  // Parse JSON safely
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // fallback: try to extract JSON array if model included text
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error(`Model did not return JSON: ${text}`);
    data = JSON.parse(text.slice(start, end + 1));
  }

  if (!Array.isArray(data)) throw new Error("Model output is not an array");

  // Normalize + validate
  const results: VisionResult[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const label = String((item as any).label ?? "").trim();
    const count = Number((item as any).count);
    const confidenceRaw = (item as any).confidence;

    if (!label) continue;
    if (!Number.isFinite(count) || count < 1) continue;

    const confidence =
      confidenceRaw === undefined ? undefined : Math.max(0, Math.min(1, Number(confidenceRaw)));

    results.push({
      label: label.toLowerCase(),
      count: Math.floor(count),
      confidence: confidence === undefined || Number.isNaN(confidence) ? undefined : confidence,
    });
  }

  // Combine duplicates (just in case)
  const merged = new Map<string, VisionResult>();
  for (const r of results) {
    const key = r.label;
    const existing = merged.get(key);
    if (!existing) merged.set(key, r);
    else existing.count += r.count;
  }

  return Array.from(merged.values());
}
