/**
 * OpenAI API Utility
 *
 * Provides functions for AI-powered image analysis using OpenAI's GPT-5.2 vision API.
 */

import { fetch } from "expo/fetch";
import * as FileSystem from "expo-file-system";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY;

/**
 * Check if OpenAI API is configured
 */
export const isOpenAIConfigured = (): boolean => {
  return !!OPENAI_API_KEY;
};

/**
 * Detected item from image analysis
 */
export type DetectedItem = {
  name: string;
  description: string;
  category?: string;
  condition?: string;
  estimatedValue?: string;
};

/**
 * Response from AI scan
 */
export type ScanResult = {
  items: DetectedItem[];
  totalCount: number;
  summary: string;
};

/**
 * Convert image URI to base64 data URL
 */
export const imageToBase64 = async (imageUri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
};

/**
 * Analyze an image to detect and identify inventory items
 */
export const analyzeInventoryImage = async (imageUri: string): Promise<ScanResult> => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set it up in the API tab.");
  }

  const base64 = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are an inventory scanning assistant. Analyze images and identify ALL items visible that could be added to an inventory system for resale (clothing, electronics, collectibles, household items, etc.).

For each item detected, provide:
1. A concise, descriptive name suitable for a product listing
2. A brief description (1-2 sentences) highlighting key features, brand if visible, size, color, material
3. Category (e.g., Clothing, Electronics, Home & Garden, Toys, Books, Accessories, etc.)
4. Condition assessment (New, Like New, Good, Fair, Poor) if determinable
5. Estimated resale value range if possible

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "items": [
    {
      "name": "Item name",
      "description": "Brief description",
      "category": "Category",
      "condition": "Condition",
      "estimatedValue": "$X-$Y or Unknown"
    }
  ],
  "totalCount": number,
  "summary": "Brief summary of image contents"
}

If no sellable items are detected, return an empty items array with totalCount of 0.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and identify all inventory items visible.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 2000,
      temperature: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("OpenAI API error:", errorData);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error("No response from AI analysis");
  }

  // Parse JSON from the response (handle markdown code blocks if present)
  let jsonStr = textContent.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as ScanResult;
    return result;
  } catch (e) {
    console.error("Failed to parse AI response:", textContent);
    throw new Error("Failed to parse AI response");
  }
};

/**
 * Counted item from image analysis
 */
export type CountedItem = {
  name: string;
  description: string;
  quantity: number;
  category?: string;
};

/**
 * Response from AI count scan
 */
export type CountScanResult = {
  items: CountedItem[];
  totalCount: number;
  summary: string;
};

/**
 * Count items in an image for inventory counting purposes
 */
export const countItemsInImage = async (
  imageUri: string,
  itemDescription?: string
): Promise<CountScanResult> => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set it up in the API tab.");
  }

  const base64 = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const userPrompt = itemDescription
    ? `Count and identify all "${itemDescription}" items visible in this image. List each distinct item with its quantity.`
    : `Count and identify all distinct items/products visible in this image that could be inventory items. List each item type with its quantity.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are an inventory counting assistant. Count and identify items in images accurately.

For each distinct item type visible:
1. Provide a name (short, descriptive)
2. Provide a description (1-2 sentences about what you see)
3. Count the quantity visible
4. Optionally categorize it

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "items": [
    {
      "name": "Item name",
      "description": "Brief description of the item",
      "quantity": number,
      "category": "Category (optional)"
    }
  ],
  "totalCount": number (sum of all quantities),
  "summary": "Brief summary of what was counted"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 1500,
      temperature: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("OpenAI API error:", errorData);
    throw new Error(`AI counting failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error("No response from AI counting");
  }

  // Parse JSON from the response
  let jsonStr = textContent.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr) as CountScanResult;
  } catch (e) {
    console.error("Failed to parse AI response:", textContent);
    throw new Error("Failed to parse AI response");
  }
};

/**
 * Detected prep item from image analysis for restaurant prep
 */
export type DetectedPrepItem = {
  name: string;
  category: string;
  suggestedUnit: string;
  suggestedParLevel: number;
  notes?: string;
};

/**
 * Response from AI prep scan
 */
export type PrepScanResult = {
  items: DetectedPrepItem[];
  totalCount: number;
  summary: string;
};

/**
 * Analyze an image to detect prep items for restaurant inventory
 */
/**
 * Invoice line item extracted from image
 */
export type InvoiceLineItem = {
  productName: string;
  quantity: number;
  unitCost: number | null;
  description?: string;
};

/**
 * Response from AI invoice scan
 */
export type InvoiceScanResult = {
  items: InvoiceLineItem[];
  totalItems: number;
  summary: string;
  vendorName?: string;
  invoiceDate?: string;
  invoiceTotal?: number;
};

/**
 * Analyze an invoice image to extract line items
 */
export const scanInvoiceImage = async (imageUri: string): Promise<InvoiceScanResult> => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set it up in the API tab.");
  }

  const base64 = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are an invoice processing assistant. Analyze invoice images and extract all product line items.

For each line item on the invoice, extract:
1. Product name (exactly as shown or reasonably interpreted)
2. Quantity ordered/received
3. Unit cost (price per unit, if shown)
4. Optional description or details

Also extract if visible:
- Vendor/supplier name
- Invoice date
- Invoice total

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "items": [
    {
      "productName": "Product name",
      "quantity": number,
      "unitCost": number or null if not shown,
      "description": "Optional details"
    }
  ],
  "totalItems": number (count of line items),
  "summary": "Brief description of the invoice",
  "vendorName": "Vendor name if visible" or null,
  "invoiceDate": "Date if visible" or null,
  "invoiceTotal": number or null if not visible
}

If the image is not an invoice or no line items can be extracted, return an empty items array.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all product line items from this invoice image.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("OpenAI API error:", errorData);
    throw new Error(`AI invoice scan failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error("No response from AI invoice scan");
  }

  // Parse JSON from the response (handle markdown code blocks if present)
  let jsonStr = textContent.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as InvoiceScanResult;
    return result;
  } catch (e) {
    console.error("Failed to parse AI response:", textContent);
    throw new Error("Failed to parse AI response");
  }
};

export const analyzePrepImage = async (imageUri: string): Promise<PrepScanResult> => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set it up in the API tab.");
  }

  const base64 = await imageToBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are a restaurant prep assistant. Analyze images of food, ingredients, or kitchen items and identify items that should be tracked on a restaurant prep sheet.

For each item detected, provide:
1. A name suitable for a prep list (e.g., "Diced Onions", "Sliced Tomatoes", "Cooked Rice")
2. Category: Choose from: Produce, Meat & Poultry, Seafood, Dairy, Dry Goods, Sauces & Dressings, Baked Goods, Desserts, Beverages, Mise en Place, Other
3. Suggested measurement unit: Choose the most appropriate from: each, pint, quart, gallon, pan, half_pan, third_pan, sixth_pan, lb, oz, kg, g, cup, tbsp, tsp, dozen, case, bag, box, bottle, bunch, head, slice, portion
4. Suggested par level: A reasonable minimum quantity to maintain (consider typical restaurant usage)
5. Optional notes: Any relevant prep instructions or storage notes

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "items": [
    {
      "name": "Item name",
      "category": "Category",
      "suggestedUnit": "unit",
      "suggestedParLevel": number,
      "notes": "Optional notes"
    }
  ],
  "totalCount": number,
  "summary": "Brief summary of what was detected"
}

If no prep items are detected, return an empty items array with totalCount of 0.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and identify all prep items that should be tracked on a restaurant prep sheet.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 2000,
      temperature: 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("OpenAI API error:", errorData);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error("No response from AI analysis");
  }

  // Parse JSON from the response (handle markdown code blocks if present)
  let jsonStr = textContent.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(jsonStr) as PrepScanResult;
    return result;
  } catch (e) {
    console.error("Failed to parse AI response:", textContent);
    throw new Error("Failed to parse AI response");
  }
};
