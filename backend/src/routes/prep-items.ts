import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import { db } from "../db";
import {
  createPrepItemSchema,
  updatePrepItemSchema,
  createPrepLogSchema,
  batchUpdateLevelsSchema,
  type PrepItem,
  type PrepLog,
  type GetPrepItemsResponse,
  type DeletePrepItemResponse,
  type GetPrepLogsResponse,
  type BatchUpdateLevelsResponse,
} from "@/shared/contracts";

const prepItemsRouter = new Hono<AppType>();

// Helper to get user's organization ID
const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
};

// Helper to convert Prisma item to API response format
const formatPrepItem = (item: {
  id: string;
  name: string;
  category: string;
  itemType: string;
  parLevel: number;
  currentLevel: number;
  unit: string;
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId?: string | null;
}): PrepItem => ({
  id: item.id,
  name: item.name,
  category: item.category,
  itemType: item.itemType as PrepItem["itemType"],
  parLevel: item.parLevel,
  currentLevel: item.currentLevel,
  unit: item.unit as PrepItem["unit"],
  notes: item.notes,
  sortOrder: item.sortOrder,
  isActive: item.isActive,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const formatPrepLog = (log: {
  id: string;
  prepItemId: string;
  quantityPrepped: number;
  preppedBy: string | null;
  notes: string | null;
  createdAt: Date;
}): PrepLog => ({
  id: log.id,
  prepItemId: log.prepItemId,
  quantityPrepped: log.quantityPrepped,
  preppedBy: log.preppedBy,
  notes: log.notes,
  createdAt: log.createdAt.toISOString(),
});

// GET /api/prep-items - Get all prep items
prepItemsRouter.get("/", async (c) => {
  const user = c.get("user");
  console.log("📋 [PrepItems] Fetching all prep items");

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const items = await db.prepItem.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    console.log(`✅ [PrepItems] Found ${items.length} items${organizationId ? ` for org ${organizationId}` : ""}`);

    return c.json({
      items: items.map(formatPrepItem),
    } satisfies GetPrepItemsResponse);
  } catch (error) {
    console.error("💥 [PrepItems] Error fetching items:", error);
    return c.json({ error: "Failed to fetch prep items" }, 500);
  }
});

// GET /api/prep-items/:id - Get single prep item
prepItemsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📋 [PrepItems] Fetching item ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const item = await db.prepItem.findUnique({
      where: { id },
    });

    if (!item) {
      console.log(`❌ [PrepItems] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    if (organizationId && item.organizationId !== organizationId) {
      console.log(`❌ [PrepItems] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    console.log(`✅ [PrepItems] Found item ${id}`);
    return c.json(formatPrepItem(item));
  } catch (error) {
    console.error("💥 [PrepItems] Error fetching item:", error);
    return c.json({ error: "Failed to fetch prep item" }, 500);
  }
});

// POST /api/prep-items - Create new prep item
prepItemsRouter.post("/", zValidator("json", createPrepItemSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log("📋 [PrepItems] Creating new item:", data.name);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const item = await db.prepItem.create({
      data: {
        name: data.name,
        category: data.category,
        itemType: data.itemType ?? "ingredient",
        parLevel: data.parLevel,
        currentLevel: data.currentLevel ?? 0,
        unit: data.unit,
        notes: data.notes ?? null,
        sortOrder: data.sortOrder ?? 0,
        organizationId,
      },
    });

    console.log(`✅ [PrepItems] Created item ${item.id}${organizationId ? ` for org ${organizationId}` : ""}`);
    return c.json(formatPrepItem(item), 201);
  } catch (error) {
    console.error("💥 [PrepItems] Error creating item:", error);
    return c.json({ error: "Failed to create prep item" }, 500);
  }
});

// PATCH /api/prep-items/:id - Update prep item
prepItemsRouter.patch("/:id", zValidator("json", updatePrepItemSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log(`📋 [PrepItems] Updating item ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.prepItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [PrepItems] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [PrepItems] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    const item = await db.prepItem.update({
      where: { id },
      data,
    });

    console.log(`✅ [PrepItems] Updated item ${id}`);
    return c.json(formatPrepItem(item));
  } catch (error) {
    console.error("💥 [PrepItems] Error updating item:", error);
    return c.json({ error: "Failed to update prep item" }, 500);
  }
});

// DELETE /api/prep-items/:id - Delete prep item
prepItemsRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📋 [PrepItems] Deleting item ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.prepItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [PrepItems] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [PrepItems] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    await db.prepItem.delete({
      where: { id },
    });

    console.log(`✅ [PrepItems] Deleted item ${id}`);
    return c.json({
      success: true,
      message: "Item deleted successfully",
    } satisfies DeletePrepItemResponse);
  } catch (error) {
    console.error("💥 [PrepItems] Error deleting item:", error);
    return c.json({ error: "Failed to delete prep item" }, 500);
  }
});

// POST /api/prep-items/:id/log - Log prep completion
prepItemsRouter.post("/:id/log", zValidator("json", createPrepLogSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log(`📋 [PrepItems] Logging prep for item ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.prepItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [PrepItems] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [PrepItems] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    // Create the log and update current level in a transaction
    const [log] = await db.$transaction([
      db.prepLog.create({
        data: {
          prepItemId: id,
          quantityPrepped: data.quantityPrepped,
          preppedBy: data.preppedBy ?? null,
          notes: data.notes ?? null,
        },
      }),
      db.prepItem.update({
        where: { id },
        data: {
          currentLevel: existing.currentLevel + data.quantityPrepped,
        },
      }),
    ]);

    console.log(`✅ [PrepItems] Logged prep for item ${id}: +${data.quantityPrepped}`);
    return c.json(formatPrepLog(log), 201);
  } catch (error) {
    console.error("💥 [PrepItems] Error logging prep:", error);
    return c.json({ error: "Failed to log prep" }, 500);
  }
});

// GET /api/prep-items/:id/logs - Get prep logs for an item
prepItemsRouter.get("/:id/logs", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📋 [PrepItems] Fetching logs for item ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.prepItem.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`❌ [PrepItems] Item ${id} not found`);
      return c.json({ error: "Item not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      console.log(`❌ [PrepItems] Item ${id} not accessible to user`);
      return c.json({ error: "Item not found" }, 404);
    }

    const logs = await db.prepLog.findMany({
      where: { prepItemId: id },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to last 50 logs
    });

    console.log(`✅ [PrepItems] Found ${logs.length} logs for item ${id}`);
    return c.json({
      logs: logs.map(formatPrepLog),
    } satisfies GetPrepLogsResponse);
  } catch (error) {
    console.error("💥 [PrepItems] Error fetching logs:", error);
    return c.json({ error: "Failed to fetch prep logs" }, 500);
  }
});

// POST /api/prep-items/update-levels - Batch update current levels
prepItemsRouter.post("/update-levels", zValidator("json", batchUpdateLevelsSchema), async (c) => {
  const { updates } = c.req.valid("json");
  const user = c.get("user");
  console.log(`📋 [PrepItems] Batch updating ${updates.length} items`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    // Verify all items exist and belong to user's organization
    const itemIds = updates.map((u) => u.id);
    const existingItems = await db.prepItem.findMany({
      where: {
        id: { in: itemIds },
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (existingItems.length !== updates.length) {
      console.log(`❌ [PrepItems] Some items not found or not accessible`);
      return c.json({ error: "Some items not found or not accessible" }, 400);
    }

    // Update all items in a transaction
    await db.$transaction(
      updates.map((update) =>
        db.prepItem.update({
          where: { id: update.id },
          data: { currentLevel: update.currentLevel },
        })
      )
    );

    console.log(`✅ [PrepItems] Updated ${updates.length} items`);
    return c.json({
      success: true,
      updatedCount: updates.length,
    } satisfies BatchUpdateLevelsResponse);
  } catch (error) {
    console.error("💥 [PrepItems] Error batch updating:", error);
    return c.json({ error: "Failed to update prep items" }, 500);
  }
});

export { prepItemsRouter };
