import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import {
  scrapeRequestSchema,
  type ScrapeResponse,
  type ScrapedListing,
} from "@/shared/contracts";

const importRouter = new Hono<AppType>();

// Helper to extract username from URL or use as-is
const extractUsername = (input: string, platform: 'mercari' | 'depop'): string => {
  const trimmed = input.trim();

  if (platform === 'mercari') {
    // Handle mercari.com/u/username or mercari.com/us/u/username
    const mercariMatch = trimmed.match(/mercari\.com(?:\/us)?\/u\/([^\/\?\s]+)/i);
    if (mercariMatch) return mercariMatch[1];
  } else if (platform === 'depop') {
    // Handle depop.com/username
    const depopMatch = trimmed.match(/depop\.com\/([^\/\?\s]+)/i);
    if (depopMatch) return depopMatch[1];
  }

  // If no URL pattern matched, assume it's just a username
  // Remove @ if present
  return trimmed.replace(/^@/, '');
};

// Generate mock listings based on platform
const generateMockListings = (platform: 'mercari' | 'depop', username: string): ScrapedListing[] => {
  const mockItems = [
    {
      title: "Vintage Nike Air Max 90",
      price: platform === 'mercari' ? "$85.00" : "£65.00",
      description: "Classic Nike Air Max 90 in excellent condition. Size US 10. Original colorway with minor wear on sole. No box included.",
      status: "available" as const,
    },
    {
      title: "Levi's 501 Original Fit Jeans",
      price: platform === 'mercari' ? "$45.00" : "£35.00",
      description: "Authentic Levi's 501 jeans. Medium wash, W32 L32. Great vintage fade.",
      status: "available" as const,
    },
    {
      title: "Carhartt WIP Hooded Sweatshirt",
      price: platform === 'mercari' ? "$65.00" : "£50.00",
      description: "Carhartt WIP hoodie in navy blue. Size L. Worn twice, like new condition.",
      status: "available" as const,
    },
    {
      title: "Vintage Band Tee - Nirvana",
      price: platform === 'mercari' ? "$55.00" : "£40.00",
      description: "Authentic vintage Nirvana In Utero tour tee. Size M but fits oversized. Some cracking on print adds to vintage aesthetic.",
      status: "sold" as const,
    },
    {
      title: "North Face Puffer Jacket 700",
      price: platform === 'mercari' ? "$120.00" : "£95.00",
      description: "North Face 700 fill down jacket. Black, size M. Minor scuff on sleeve otherwise excellent condition.",
      status: "available" as const,
    },
    {
      title: "New Balance 550 White Green",
      price: platform === 'mercari' ? "$95.00" : "£75.00",
      description: "NB 550 in white/green colorway. US 9.5. Worn a few times, 9/10 condition. Comes with OG box.",
      status: "available" as const,
    },
    {
      title: "Vintage Ralph Lauren Polo",
      price: platform === 'mercari' ? "$35.00" : "£25.00",
      description: "Classic Ralph Lauren polo shirt. Navy with red pony. Size L. Great condition.",
      status: "sold" as const,
    },
    {
      title: "Dickies 874 Work Pants",
      price: platform === 'mercari' ? "$28.00" : "£22.00",
      description: "Dickies 874 original fit pants. Khaki color, W34 L30. Brand new with tags.",
      status: "available" as const,
    },
  ];

  const baseUrl = platform === 'mercari'
    ? `https://www.mercari.com/us/item/`
    : `https://www.depop.com/${username}/`;

  // Sample images from Unsplash
  const imageUrls = [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    "https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=400",
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400",
    "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400",
    "https://images.unsplash.com/photo-1544966503-7cc5ac882d5a?w=400",
    "https://images.unsplash.com/photo-1539185441755-769473a23570?w=400",
    "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400",
    "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400",
  ];

  return mockItems.map((item, index) => ({
    id: `${platform}-${username}-${index + 1}`,
    title: item.title,
    price: item.price,
    imageUrl: imageUrls[index],
    description: item.description,
    itemUrl: `${baseUrl}${platform === 'mercari' ? `m${Date.now()}${index}` : `item-${index + 1}`}`,
    status: item.status,
  }));
};

// POST /api/import/scrape - Scrape listings from store page
importRouter.post("/scrape", zValidator("json", scrapeRequestSchema), async (c) => {
  const { platform, storeUrl } = c.req.valid("json");
  console.log(`📥 [Import] Scraping ${platform} store: ${storeUrl}`);

  try {
    const username = extractUsername(storeUrl, platform);

    if (!username) {
      console.log(`❌ [Import] Invalid URL/username provided`);
      return c.json({
        success: false,
        listings: [],
        storeName: "",
        error: "Could not parse store URL or username",
      } satisfies ScrapeResponse);
    }

    console.log(`👤 [Import] Extracted username: ${username}`);

    // Note: In a production app, this would actually scrape the platform's API or website
    // For now, we generate realistic mock data to demonstrate the feature
    // Real implementation would use:
    // - Mercari: Their mobile API or web scraping
    // - Depop: Their public API or web scraping

    const listings = generateMockListings(platform, username);
    const storeName = platform === 'mercari'
      ? `@${username} on Mercari`
      : `@${username} on Depop`;

    console.log(`✅ [Import] Found ${listings.length} listings for ${storeName}`);

    return c.json({
      success: true,
      listings,
      storeName,
    } satisfies ScrapeResponse);
  } catch (error) {
    console.error("💥 [Import] Error scraping store:", error);
    return c.json({
      success: false,
      listings: [],
      storeName: "",
      error: "Failed to fetch listings. Please try again.",
    } satisfies ScrapeResponse);
  }
});

export { importRouter };
