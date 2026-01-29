import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import { db } from "../db";
import {
  createCycleCountSchema,
  updateCycleCountSchema,
  recordCountSchema,
  completeCycleCountSchema,
  type CycleCount,
  type CycleCountItem,
  type GetCycleCountsResponse,
  type GetCycleCountResponse,
  type DeleteCycleCountResponse,
} from "@/shared/contracts";

const cycleCountsRouter = new Hono<AppType>();

// Helper to get user's organization ID
const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
};

// Helper to format cycle count for API response
const formatCycleCount = (
  cycleCount: {
    id: string;
    name: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  stats?: { totalItems: number; countedItems: number; itemsWithVariance: number }
): CycleCount => ({
  id: cycleCount.id,
  name: cycleCount.name,
  status: cycleCount.status as "in_progress" | "completed" | "cancelled",
  startedAt: cycleCount.startedAt.toISOString(),
  completedAt: cycleCount.completedAt?.toISOString() ?? null,
  notes: cycleCount.notes,
  createdAt: cycleCount.createdAt.toISOString(),
  updatedAt: cycleCount.updatedAt.toISOString(),
  totalItems: stats?.totalItems,
  countedItems: stats?.countedItems,
  itemsWithVariance: stats?.itemsWithVariance,
});

// Helper to format cycle count item for API response
const formatCycleCountItem = (
  item: {
    id: string;
    cycleCountId: string;
    inventoryItemId: string;
    expectedQty: number;
    countedQty: number | null;
    variance: number | null;
    notes: string | null;
    countedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem?: {
      id: string;
      name: string;
      imageUrl: string;
      binNumber: string;
      rackNumber: string;
    };
  }
): CycleCountItem => ({
  id: item.id,
  cycleCountId: item.cycleCountId,
  inventoryItemId: item.inventoryItemId,
  expectedQty: item.expectedQty,
  countedQty: item.countedQty,
  variance: item.variance,
  notes: item.notes,
  countedAt: item.countedAt?.toISOString() ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  inventoryItem: item.inventoryItem
    ? {
        id: item.inventoryItem.id,
        name: item.inventoryItem.name,
        imageUrl: item.inventoryItem.imageUrl,
        binNumber: item.inventoryItem.binNumber,
        rackNumber: item.inventoryItem.rackNumber,
      }
    : undefined,
});

// GET /api/cycle-counts - Get all cycle counts
cycleCountsRouter.get("/", async (c) => {
  const user = c.get("user");
  console.log("📋 [CycleCounts] Fetching all cycle counts");

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const cycleCounts = await db.cycleCount.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    const formattedCounts = cycleCounts.map((cc) => {
      const totalItems = cc.items.length;
      const countedItems = cc.items.filter((i) => i.countedQty !== null).length;
      const itemsWithVariance = cc.items.filter(
        (i) => i.variance !== null && i.variance !== 0
      ).length;

      return formatCycleCount(cc, { totalItems, countedItems, itemsWithVariance });
    });

    console.log(`✅ [CycleCounts] Found ${cycleCounts.length} cycle counts`);
    return c.json({ cycleCounts: formattedCounts } satisfies GetCycleCountsResponse);
  } catch (error) {
    console.error("💥 [CycleCounts] Error fetching cycle counts:", error);
    return c.json({ error: "Failed to fetch cycle counts" }, 500);
  }
});

// GET /api/cycle-counts/:id - Get single cycle count with items
cycleCountsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📋 [CycleCounts] Fetching cycle count ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const cycleCount = await db.cycleCount.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                binNumber: true,
                rackNumber: true,
              },
            },
          },
          orderBy: [
            { countedAt: { sort: "asc", nulls: "first" } },
            { inventoryItem: { name: "asc" } },
          ],
        },
      },
    });

    if (!cycleCount) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    if (organizationId && cycleCount.organizationId !== organizationId) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    const totalItems = cycleCount.items.length;
    const countedItems = cycleCount.items.filter((i) => i.countedQty !== null).length;
    const itemsWithVariance = cycleCount.items.filter(
      (i) => i.variance !== null && i.variance !== 0
    ).length;

    const response: GetCycleCountResponse = {
      ...formatCycleCount(cycleCount, { totalItems, countedItems, itemsWithVariance }),
      items: cycleCount.items.map(formatCycleCountItem),
    };

    console.log(`✅ [CycleCounts] Found cycle count ${id} with ${totalItems} items`);
    return c.json(response);
  } catch (error) {
    console.error("💥 [CycleCounts] Error fetching cycle count:", error);
    return c.json({ error: "Failed to fetch cycle count" }, 500);
  }
});

// POST /api/cycle-counts - Create new cycle count
cycleCountsRouter.post("/", zValidator("json", createCycleCountSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log("📋 [CycleCounts] Creating new cycle count:", data.name);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    // Get all active inventory items to include in the count
    const inventoryItems = await db.inventoryItem.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: "pending", // Only count items that are still in stock
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    // Create cycle count with all inventory items
    const cycleCount = await db.cycleCount.create({
      data: {
        name: data.name,
        notes: data.notes ?? null,
        organizationId,
        items: {
          create: inventoryItems.map((item) => ({
            inventoryItemId: item.id,
            expectedQty: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    console.log(
      `✅ [CycleCounts] Created cycle count ${cycleCount.id} with ${inventoryItems.length} items`
    );

    return c.json(
      formatCycleCount(cycleCount, {
        totalItems: cycleCount.items.length,
        countedItems: 0,
        itemsWithVariance: 0,
      }),
      201
    );
  } catch (error) {
    console.error("💥 [CycleCounts] Error creating cycle count:", error);
    return c.json({ error: "Failed to create cycle count" }, 500);
  }
});

// PATCH /api/cycle-counts/:id - Update cycle count
cycleCountsRouter.patch("/:id", zValidator("json", updateCycleCountSchema), async (c) => {
  const { id } = c.req.param();
  const data = c.req.valid("json");
  const user = c.get("user");
  console.log(`📋 [CycleCounts] Updating cycle count ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.cycleCount.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    const cycleCount = await db.cycleCount.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
        notes: data.notes,
      },
      include: {
        items: true,
      },
    });

    const totalItems = cycleCount.items.length;
    const countedItems = cycleCount.items.filter((i) => i.countedQty !== null).length;
    const itemsWithVariance = cycleCount.items.filter(
      (i) => i.variance !== null && i.variance !== 0
    ).length;

    console.log(`✅ [CycleCounts] Updated cycle count ${id}`);
    return c.json(formatCycleCount(cycleCount, { totalItems, countedItems, itemsWithVariance }));
  } catch (error) {
    console.error("💥 [CycleCounts] Error updating cycle count:", error);
    return c.json({ error: "Failed to update cycle count" }, 500);
  }
});

// POST /api/cycle-counts/:id/items/:itemId/count - Record a count for an item
cycleCountsRouter.post(
  "/:id/items/:itemId/count",
  zValidator("json", recordCountSchema),
  async (c) => {
    const { id, itemId } = c.req.param();
    const data = c.req.valid("json");
    const user = c.get("user");
    console.log(`📋 [CycleCounts] Recording count for item ${itemId} in cycle count ${id}`);

    try {
      let organizationId: string | null = null;
      if (user) {
        organizationId = await getUserOrganizationId(user.id);
      }

      // Verify cycle count exists and is in progress
      const cycleCount = await db.cycleCount.findUnique({
        where: { id },
      });

      if (!cycleCount) {
        return c.json({ error: "Cycle count not found" }, 404);
      }

      if (organizationId && cycleCount.organizationId !== organizationId) {
        return c.json({ error: "Cycle count not found" }, 404);
      }

      if (cycleCount.status !== "in_progress") {
        return c.json({ error: "Cycle count is not in progress" }, 400);
      }

      // Find the cycle count item
      const cycleCountItem = await db.cycleCountItem.findUnique({
        where: {
          cycleCountId_inventoryItemId: {
            cycleCountId: id,
            inventoryItemId: itemId,
          },
        },
        include: {
          inventoryItem: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              binNumber: true,
              rackNumber: true,
            },
          },
        },
      });

      if (!cycleCountItem) {
        return c.json({ error: "Item not found in this cycle count" }, 404);
      }

      // Calculate variance
      const variance = data.countedQty - cycleCountItem.expectedQty;

      // Update the item with the count
      const updatedItem = await db.cycleCountItem.update({
        where: { id: cycleCountItem.id },
        data: {
          countedQty: data.countedQty,
          variance,
          notes: data.notes ?? null,
          countedAt: new Date(),
        },
        include: {
          inventoryItem: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              binNumber: true,
              rackNumber: true,
            },
          },
        },
      });

      console.log(
        `✅ [CycleCounts] Recorded count ${data.countedQty} for item ${itemId} (variance: ${variance})`
      );
      return c.json(formatCycleCountItem(updatedItem));
    } catch (error) {
      console.error("💥 [CycleCounts] Error recording count:", error);
      return c.json({ error: "Failed to record count" }, 500);
    }
  }
);

// POST /api/cycle-counts/:id/complete - Complete and apply cycle count
cycleCountsRouter.post(
  "/:id/complete",
  zValidator("json", completeCycleCountSchema),
  async (c) => {
    const { id } = c.req.param();
    const data = c.req.valid("json");
    const user = c.get("user");
    console.log(`📋 [CycleCounts] Completing cycle count ${id}`);

    try {
      let organizationId: string | null = null;
      if (user) {
        organizationId = await getUserOrganizationId(user.id);
      }

      const cycleCount = await db.cycleCount.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!cycleCount) {
        return c.json({ error: "Cycle count not found" }, 404);
      }

      if (organizationId && cycleCount.organizationId !== organizationId) {
        return c.json({ error: "Cycle count not found" }, 404);
      }

      if (cycleCount.status !== "in_progress") {
        return c.json({ error: "Cycle count is not in progress" }, 400);
      }

      // Apply changes to inventory if requested
      if (data.applyChanges) {
        // Only update items that have been counted
        const countedItems = cycleCount.items.filter((i) => i.countedQty !== null);

        for (const item of countedItems) {
          await db.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { quantity: item.countedQty! },
          });
        }

        console.log(`✅ [CycleCounts] Applied ${countedItems.length} quantity updates`);
      }

      // Mark cycle count as completed
      const updatedCycleCount = await db.cycleCount.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      const totalItems = updatedCycleCount.items.length;
      const countedItems = updatedCycleCount.items.filter((i) => i.countedQty !== null).length;
      const itemsWithVariance = updatedCycleCount.items.filter(
        (i) => i.variance !== null && i.variance !== 0
      ).length;

      console.log(`✅ [CycleCounts] Completed cycle count ${id}`);
      return c.json(
        formatCycleCount(updatedCycleCount, { totalItems, countedItems, itemsWithVariance })
      );
    } catch (error) {
      console.error("💥 [CycleCounts] Error completing cycle count:", error);
      return c.json({ error: "Failed to complete cycle count" }, 500);
    }
  }
);

// DELETE /api/cycle-counts/:id - Delete/cancel cycle count
cycleCountsRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  console.log(`📋 [CycleCounts] Deleting cycle count ${id}`);

  try {
    let organizationId: string | null = null;
    if (user) {
      organizationId = await getUserOrganizationId(user.id);
    }

    const existing = await db.cycleCount.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    if (organizationId && existing.organizationId !== organizationId) {
      return c.json({ error: "Cycle count not found" }, 404);
    }

    await db.cycleCount.delete({
      where: { id },
    });

    console.log(`✅ [CycleCounts] Deleted cycle count ${id}`);
    return c.json({
      success: true,
      message: "Cycle count deleted successfully",
    } satisfies DeleteCycleCountResponse);
  } catch (error) {
    console.error("💥 [CycleCounts] Error deleting cycle count:", error);
    return c.json({ error: "Failed to delete cycle count" }, 500);
  }
});

export { cycleCountsRouter };
