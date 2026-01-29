import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import { db } from "../db";
import {
  createOrderSchema,
  updateOrderSchema,
  addOrderItemSchema,
  updateOrderItemSchema,
  receiveOrderSchema,
  type Order,
  type OrderItem,
  type GetOrdersResponse,
  type GetBelowParItemsResponse,
} from "@/shared/contracts";

const ordersRouter = new Hono<AppType>();

// Helper to get user's organization ID
const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
};

// Generate order number
const generateOrderNumber = (): string => {
  const date = new Date();
  const prefix = "PO";
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${datePart}-${random}`;
};

// Format order for API response
const formatOrder = (order: any): Order => ({
  id: order.id,
  orderNumber: order.orderNumber,
  vendorId: order.vendorId,
  vendor: order.vendor
    ? {
        id: order.vendor.id,
        name: order.vendor.name,
        contactName: order.vendor.contactName,
        email: order.vendor.email,
        phone: order.vendor.phone,
        address: order.vendor.address,
        notes: order.vendor.notes,
        createdAt: order.vendor.createdAt.toISOString(),
        updatedAt: order.vendor.updatedAt.toISOString(),
      }
    : undefined,
  status: order.status as "draft" | "submitted" | "received" | "cancelled",
  notes: order.notes,
  submittedAt: order.submittedAt?.toISOString() ?? null,
  receivedAt: order.receivedAt?.toISOString() ?? null,
  totalAmount: order.totalAmount,
  items: order.items?.map((item: any) => ({
    id: item.id,
    orderId: item.orderId,
    inventoryItemId: item.inventoryItemId,
    inventoryItem: item.inventoryItem
      ? {
          id: item.inventoryItem.id,
          name: item.inventoryItem.name,
          description: item.inventoryItem.description,
          imageUrl: item.inventoryItem.imageUrl,
          binNumber: item.inventoryItem.binNumber,
          rackNumber: item.inventoryItem.rackNumber,
          platform: item.inventoryItem.platform,
          status: item.inventoryItem.status,
          quantity: item.inventoryItem.quantity,
          parLevel: item.inventoryItem.parLevel,
          cost: item.inventoryItem.cost,
          soldAt: item.inventoryItem.soldAt?.toISOString() ?? null,
          soldPrice: item.inventoryItem.soldPrice,
          shipByDate: item.inventoryItem.shipByDate?.toISOString() ?? null,
          shipperQrCode: item.inventoryItem.shipperQrCode,
          createdAt: item.inventoryItem.createdAt.toISOString(),
          updatedAt: item.inventoryItem.updatedAt.toISOString(),
        }
      : undefined,
    quantity: item.quantity,
    unitCost: item.unitCost,
    totalCost: item.totalCost,
    notes: item.notes,
  })),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

// GET /api/orders - List all orders
ordersRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log("📋 [Orders] Fetching orders");

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const orders = await db.order.findMany({
      where: organizationId ? { organizationId } : {},
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ [Orders] Found ${orders.length} orders`);
    return c.json({
      orders: orders.map(formatOrder),
    } satisfies GetOrdersResponse);
  } catch (error) {
    console.error("💥 [Orders] Error fetching orders:", error);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
});

// GET /api/orders/below-par/:vendorId - Get items below par for a vendor
ordersRouter.get("/below-par/:vendorId", async (c) => {
  const { vendorId } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`📋 [Orders] Fetching below-par items for vendor ${vendorId}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    // Get vendor's linked products
    const vendorProducts = await db.vendorProduct.findMany({
      where: { vendorId },
      include: { inventoryItem: true },
    });

    // Filter to items below par level
    const belowParItems = vendorProducts
      .filter((vp) => {
        const item = vp.inventoryItem;
        return item.parLevel !== null && item.quantity < item.parLevel;
      })
      .map((vp) => ({
        inventoryItem: {
          id: vp.inventoryItem.id,
          name: vp.inventoryItem.name,
          description: vp.inventoryItem.description,
          imageUrl: vp.inventoryItem.imageUrl,
          binNumber: vp.inventoryItem.binNumber,
          rackNumber: vp.inventoryItem.rackNumber,
          platform: vp.inventoryItem.platform,
          status: vp.inventoryItem.status as "pending" | "completed" | "sold",
          quantity: vp.inventoryItem.quantity,
          parLevel: vp.inventoryItem.parLevel,
          cost: vp.inventoryItem.cost,
          soldAt: vp.inventoryItem.soldAt?.toISOString() ?? null,
          soldPrice: vp.inventoryItem.soldPrice,
          shipByDate: vp.inventoryItem.shipByDate?.toISOString() ?? null,
          shipperQrCode: vp.inventoryItem.shipperQrCode,
          createdAt: vp.inventoryItem.createdAt.toISOString(),
          updatedAt: vp.inventoryItem.updatedAt.toISOString(),
        },
        vendorProduct: {
          id: vp.id,
          vendorId: vp.vendorId,
          inventoryItemId: vp.inventoryItemId,
          inventoryItem: {} as any, // Already provided above
          vendorSku: vp.vendorSku,
          unitCost: vp.unitCost,
          minOrderQty: vp.minOrderQty,
        },
        currentQty: vp.inventoryItem.quantity,
        parLevel: vp.inventoryItem.parLevel!,
        orderQty: vp.inventoryItem.parLevel! - vp.inventoryItem.quantity,
      }));

    console.log(`✅ [Orders] Found ${belowParItems.length} below-par items`);
    return c.json({ items: belowParItems } satisfies GetBelowParItemsResponse);
  } catch (error) {
    console.error("💥 [Orders] Error fetching below-par items:", error);
    return c.json({ error: "Failed to fetch below-par items" }, 500);
  }
});

// GET /api/orders/:id - Get single order
ordersRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }

    return c.json(formatOrder(order));
  } catch (error) {
    console.error("💥 [Orders] Error fetching order:", error);
    return c.json({ error: "Failed to fetch order" }, 500);
  }
});

// POST /api/orders - Create order
ordersRouter.post("/", zValidator("json", createOrderSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`📋 [Orders] Creating order for vendor ${data.vendorId}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    // Verify vendor exists
    const vendor = await db.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    const orderNumber = generateOrderNumber();

    const order = await db.order.create({
      data: {
        orderNumber,
        vendorId: data.vendorId,
        notes: data.notes ?? null,
        organizationId,
        items: data.items
          ? {
              create: data.items.map((item) => ({
                inventoryItemId: item.inventoryItemId,
                quantity: item.quantity,
                unitCost: item.unitCost ?? null,
                totalCost: item.unitCost ? item.unitCost * item.quantity : null,
                notes: item.notes ?? null,
              })),
            }
          : undefined,
      },
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    // Calculate total amount
    const totalAmount = order.items.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);
    if (totalAmount > 0) {
      await db.order.update({
        where: { id: order.id },
        data: { totalAmount },
      });
      order.totalAmount = totalAmount;
    }

    console.log(`✅ [Orders] Created order ${order.orderNumber}`);
    return c.json(formatOrder(order), 201);
  } catch (error) {
    console.error("💥 [Orders] Error creating order:", error);
    return c.json({ error: "Failed to create order" }, 500);
  }
});

// PATCH /api/orders/:id - Update order
ordersRouter.patch("/:id", zValidator("json", updateOrderSchema), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`📋 [Orders] Updating order ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && existing.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }

    const order = await db.order.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.status && { status: data.status }),
      },
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    console.log(`✅ [Orders] Updated order ${id}`);
    return c.json(formatOrder(order));
  } catch (error) {
    console.error("💥 [Orders] Error updating order:", error);
    return c.json({ error: "Failed to update order" }, 500);
  }
});

// POST /api/orders/:id/items - Add item to order
ordersRouter.post("/:id/items", zValidator("json", addOrderItemSchema), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`📋 [Orders] Adding item to order ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status !== "draft") {
      return c.json({ error: "Cannot modify submitted order" }, 400);
    }

    const item = await db.orderItem.create({
      data: {
        orderId: id,
        inventoryItemId: data.inventoryItemId,
        quantity: data.quantity,
        unitCost: data.unitCost ?? null,
        totalCost: data.unitCost ? data.unitCost * data.quantity : null,
        notes: data.notes ?? null,
      },
      include: { inventoryItem: true },
    });

    // Update order total
    const allItems = await db.orderItem.findMany({ where: { orderId: id } });
    const totalAmount = allItems.reduce((sum, i) => sum + (i.totalCost ?? 0), 0);
    await db.order.update({
      where: { id },
      data: { totalAmount: totalAmount > 0 ? totalAmount : null },
    });

    console.log(`✅ [Orders] Added item to order ${id}`);
    return c.json({
      id: item.id,
      orderId: item.orderId,
      inventoryItemId: item.inventoryItemId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      notes: item.notes,
    } satisfies OrderItem, 201);
  } catch (error) {
    console.error("💥 [Orders] Error adding item:", error);
    return c.json({ error: "Failed to add item" }, 500);
  }
});

// PATCH /api/orders/:id/items/:itemId - Update order item
ordersRouter.patch("/:id/items/:itemId", zValidator("json", updateOrderItemSchema), async (c) => {
  const { id, itemId } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status !== "draft") {
      return c.json({ error: "Cannot modify submitted order" }, 400);
    }

    const existing = await db.orderItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      return c.json({ error: "Item not found" }, 404);
    }

    const quantity = data.quantity ?? existing.quantity;
    const unitCost = data.unitCost ?? existing.unitCost;
    const totalCost = unitCost ? unitCost * quantity : null;

    const item = await db.orderItem.update({
      where: { id: itemId },
      data: {
        ...(data.quantity && { quantity: data.quantity }),
        ...(data.unitCost !== undefined && { unitCost: data.unitCost }),
        totalCost,
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });

    // Update order total
    const allItems = await db.orderItem.findMany({ where: { orderId: id } });
    const totalAmount = allItems.reduce((sum, i) => sum + (i.totalCost ?? 0), 0);
    await db.order.update({
      where: { id },
      data: { totalAmount: totalAmount > 0 ? totalAmount : null },
    });

    return c.json({
      id: item.id,
      orderId: item.orderId,
      inventoryItemId: item.inventoryItemId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      notes: item.notes,
    } satisfies OrderItem);
  } catch (error) {
    console.error("💥 [Orders] Error updating item:", error);
    return c.json({ error: "Failed to update item" }, 500);
  }
});

// DELETE /api/orders/:id/items/:itemId - Remove item from order
ordersRouter.delete("/:id/items/:itemId", async (c) => {
  const { id, itemId } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status !== "draft") {
      return c.json({ error: "Cannot modify submitted order" }, 400);
    }

    await db.orderItem.delete({ where: { id: itemId } });

    // Update order total
    const allItems = await db.orderItem.findMany({ where: { orderId: id } });
    const totalAmount = allItems.reduce((sum, i) => sum + (i.totalCost ?? 0), 0);
    await db.order.update({
      where: { id },
      data: { totalAmount: totalAmount > 0 ? totalAmount : null },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("💥 [Orders] Error removing item:", error);
    return c.json({ error: "Failed to remove item" }, 500);
  }
});

// POST /api/orders/:id/submit - Submit order
ordersRouter.post("/:id/submit", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`📋 [Orders] Submitting order ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status !== "draft") {
      return c.json({ error: "Order already submitted" }, 400);
    }
    if (order.items.length === 0) {
      return c.json({ error: "Cannot submit empty order" }, 400);
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
      },
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    console.log(`✅ [Orders] Submitted order ${id}`);
    return c.json(formatOrder(updated));
  } catch (error) {
    console.error("💥 [Orders] Error submitting order:", error);
    return c.json({ error: "Failed to submit order" }, 500);
  }
});

// POST /api/orders/:id/receive - Mark order as received
ordersRouter.post("/:id/receive", zValidator("json", receiveOrderSchema), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`📋 [Orders] Receiving order ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (order.status !== "submitted") {
      return c.json({ error: "Order must be submitted first" }, 400);
    }

    // Update inventory quantities if requested
    if (data.updateInventory) {
      for (const item of order.items) {
        await db.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    const updated = await db.order.update({
      where: { id },
      data: {
        status: "received",
        receivedAt: new Date(),
      },
      include: {
        vendor: true,
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    console.log(`✅ [Orders] Received order ${id}${data.updateInventory ? " and updated inventory" : ""}`);
    return c.json(formatOrder(updated));
  } catch (error) {
    console.error("💥 [Orders] Error receiving order:", error);
    return c.json({ error: "Failed to receive order" }, 500);
  }
});

// DELETE /api/orders/:id - Delete/cancel order
ordersRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`📋 [Orders] Deleting order ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }
    if (organizationId && order.organizationId !== organizationId) {
      return c.json({ error: "Order not found" }, 404);
    }

    if (order.status === "received") {
      return c.json({ error: "Cannot delete received order" }, 400);
    }

    await db.order.delete({ where: { id } });

    console.log(`✅ [Orders] Deleted order ${id}`);
    return c.json({ success: true, message: "Order deleted" });
  } catch (error) {
    console.error("💥 [Orders] Error deleting order:", error);
    return c.json({ error: "Failed to delete order" }, 500);
  }
});

export { ordersRouter };
