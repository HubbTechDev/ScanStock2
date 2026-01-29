import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import { db } from "../db";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  searchInventoryRequestSchema,
  searchByPhotoRequestSchema,
  type InventoryItem,
  type GetInventoryResponse,
  type DeleteInventoryItemResponse,
  type SearchByPhotoResponse,
} from "@/shared/contracts";

const inventoryRouter = new Hono<AppType>();

// Helper to get user's organization ID
const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
};

// Helper to convert Prisma item to API response format
const formatItem = (item: {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  binNumber: string;
  rackNumber: string;
  platform: string;
  status: string;
  quantity: number;
  parLevel: number | null;
  cost: number | null;
  soldAt: Date | null;
  soldPrice: number | null;
  shipByDate: Date | null;
  shipperQrCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string | null;
}): InventoryItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  imageUrl: item.imageUrl,
  binNumber: item.binNumber,
  rackNumber: item.rackNumber,
  platform: item.platform,
  status: item.status as "pending" | "completed" | "sold",
  quantity: item.quantity,
  parLevel: item.parLevel,
  cost: item.cost,
  soldAt: item.soldAt?.toISOString() ?? null,
  soldPrice: item.soldPrice,
  shipByDate: item.shipByDate?.toISOString() ?? null,
  shipperQrCode: item.shipperQrCode,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

// GET /api/inventory - Get all inventory items with stats
inventoryRouter.get("/", async (c) => {
  const user = c.get("user");
  console.log("📦 [Inventory] Fetching all inventory items");

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    // Filter by organization if user has one
    const items = await db.inventoryItem.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      completed: items.filter((i) => i.status === "completed").length,
      sold: items.filter((i) => i.status === "sold").length,
    };

    console.log(`✅ [Inventory] Found ${items.length} items${organizationId ? ` for org ${organizationId}` : ""}`);

    return c.json({
      items: items.map(formatItem),
      stats,
    } satisfies GetInventoryResponse);
  } catch (error) {
    console.error("💥 [Inventory] Error fetching items:", error);
    return c.json({ error: "Failed to fetch inventory items" }, 500);
  }
});

// GET /api/inventory/:id - Get single inventory item
inventoryRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📦 [Inventory] Fetching item ${id}`);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const item = await db.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      console.log(`❌ [Inventory] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    // Check if item belongs to user's organization
    if (organizationId && item.organizationId !== organizationId) {
      console.log(`❌ [Inventory] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    console.log(`✅ [Inventory] Found item ${id}`);
    return c.json(formatItem(item));
  } catch (error) {
    console.error("💥 [Inventory] Error fetching item:", error);
    return c.json({ error: "Failed to fetch inventory item" }, 500);
  }
});

// POST /api/inventory - Create new inventory item
inventoryRouter.post("/", zValidator("json", createInventoryItemSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log("📦 [Inventory] Creating new item:", data.name);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const item = await db.inventoryItem.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        binNumber: data.binNumber ?? "",
        rackNumber: data.rackNumber ?? "",
        platform: data.platform ?? "",
        quantity: data.quantity ?? 1,
        cost: data.cost ?? null,
        status: data.status ?? "pending",
        organizationId, // Associate with user's organization
      },
    });

    console.log(`✅ [Inventory] Created item ${item.id}${organizationId ? ` for org ${organizationId}` : ""}`);
    return c.json(formatItem(item), 201);
  } catch (error) {
    console.error("💥 [Inventory] Error creating item:", error);
    return c.json({ error: "Failed to create inventory item" }, 500);
  }
});

// PATCH /api/inventory/:id - Update inventory item
inventoryRouter.patch("/:id", zValidator("json", updateInventoryItemSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log(`📦 [Inventory] Updating item ${id}`);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.inventoryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [Inventory] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    // Check if item belongs to user's organization
    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [Inventory] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    // If status is being changed to "sold", set soldAt
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === "sold" && existing.status !== "sold") {
      updateData.soldAt = new Date();
    }

    // Handle shipByDate - convert string to Date or null
    if (data.shipByDate !== undefined) {
      updateData.shipByDate = data.shipByDate ? new Date(data.shipByDate) : null;
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ [Inventory] Updated item ${id}`);
    return c.json(formatItem(item));
  } catch (error) {
    console.error("💥 [Inventory] Error updating item:", error);
    return c.json({ error: "Failed to update inventory item" }, 500);
  }
});

// DELETE /api/inventory/:id - Delete inventory item
inventoryRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📦 [Inventory] Deleting item ${id}`);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.inventoryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [Inventory] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    // Check if item belongs to user's organization
    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [Inventory] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    await db.inventoryItem.delete({
      where: { id },
    });

    console.log(`✅ [Inventory] Deleted item ${id}`);
    return c.json({
      success: true,
      message: "Item deleted successfully",
    } satisfies DeleteInventoryItemResponse);
  } catch (error) {
    console.error("💥 [Inventory] Error deleting item:", error);
    return c.json({ error: "Failed to delete inventory item" }, 500);
  }
});

// POST /api/inventory/search - Search inventory items
inventoryRouter.post("/search", zValidator("json", searchInventoryRequestSchema), async (c) => {
  const { query, status } = c.req.valid("json");
  const user = c.get("user");
  console.log(`📦 [Inventory] Searching items with query: ${query}, status: ${status}`);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const items = await db.inventoryItem.findMany({
      where: {
        AND: [
          organizationId ? { organizationId } : {},
          status ? { status } : {},
          query
            ? {
                OR: [
                  { name: { contains: query } },
                  { description: { contains: query } },
                  { binNumber: { contains: query } },
                  { rackNumber: { contains: query } },
                  { platform: { contains: query } },
                ],
              }
            : {},
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ [Inventory] Found ${items.length} matching items`);
    return c.json(items.map(formatItem));
  } catch (error) {
    console.error("💥 [Inventory] Error searching items:", error);
    return c.json({ error: "Failed to search inventory items" }, 500);
  }
});

// POST /api/inventory/search-by-photo - Search inventory by photo
inventoryRouter.post("/search-by-photo", zValidator("json", searchByPhotoRequestSchema), async (c) => {
  const { image, itemIds } = c.req.valid("json");
  const user = c.get("user");
  console.log(`📷 [Inventory] Photo search for ${itemIds.length} items`);

  try {
    // Get user's organization if authenticated
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    // Get all items that match the provided IDs and organization
    const items = await db.inventoryItem.findMany({
      where: {
        id: { in: itemIds },
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (items.length === 0) {
      return c.json({ matchingItemIds: [] } satisfies SearchByPhotoResponse);
    }

    // Return all items sorted by most recent
    const matchingItemIds = items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(item => item.id);

    console.log(`✅ [Inventory] Photo search found ${matchingItemIds.length} potential matches`);
    return c.json({ matchingItemIds } satisfies SearchByPhotoResponse);
  } catch (error) {
    console.error("💥 [Inventory] Error in photo search:", error);
    return c.json({ error: "Failed to search by photo" }, 500);
  }
});

export { inventoryRouter };
