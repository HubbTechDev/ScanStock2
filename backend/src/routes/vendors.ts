import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { type AppType } from "../types";
import { db } from "../db";
import {
  createVendorSchema,
  updateVendorSchema,
  linkVendorProductSchema,
  type Vendor,
  type VendorProduct,
  type GetVendorsResponse,
  type GetVendorProductsResponse,
} from "@/shared/contracts";

const vendorsRouter = new Hono<AppType>();

// Helper to get user's organization ID
const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
};

// Format vendor for API response
const formatVendor = (vendor: {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Vendor => ({
  id: vendor.id,
  name: vendor.name,
  contactName: vendor.contactName,
  email: vendor.email,
  phone: vendor.phone,
  address: vendor.address,
  notes: vendor.notes,
  createdAt: vendor.createdAt.toISOString(),
  updatedAt: vendor.updatedAt.toISOString(),
});

// GET /api/vendors - List all vendors
vendorsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log("🏪 [Vendors] Fetching vendors");

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendors = await db.vendor.findMany({
      where: organizationId ? { organizationId } : {},
      orderBy: { name: "asc" },
    });

    console.log(`✅ [Vendors] Found ${vendors.length} vendors`);
    return c.json({
      vendors: vendors.map(formatVendor),
    } satisfies GetVendorsResponse);
  } catch (error) {
    console.error("💥 [Vendors] Error fetching vendors:", error);
    return c.json({ error: "Failed to fetch vendors" }, 500);
  }
});

// GET /api/vendors/:id - Get single vendor
vendorsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendor = await db.vendor.findUnique({
      where: { id },
    });

    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    if (organizationId && vendor.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    return c.json(formatVendor(vendor));
  } catch (error) {
    console.error("💥 [Vendors] Error fetching vendor:", error);
    return c.json({ error: "Failed to fetch vendor" }, 500);
  }
});

// POST /api/vendors - Create vendor
vendorsRouter.post("/", zValidator("json", createVendorSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`🏪 [Vendors] Creating vendor: ${data.name}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendor = await db.vendor.create({
      data: {
        name: data.name,
        contactName: data.contactName ?? null,
        email: data.email || null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        organizationId,
      },
    });

    console.log(`✅ [Vendors] Created vendor ${vendor.id}`);
    return c.json(formatVendor(vendor), 201);
  } catch (error) {
    console.error("💥 [Vendors] Error creating vendor:", error);
    return c.json({ error: "Failed to create vendor" }, 500);
  }
});

// PATCH /api/vendors/:id - Update vendor
vendorsRouter.patch("/:id", zValidator("json", updateVendorSchema), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`🏪 [Vendors] Updating vendor ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const existing = await db.vendor.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    if (organizationId && existing.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    const vendor = await db.vendor.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });

    console.log(`✅ [Vendors] Updated vendor ${vendor.id}`);
    return c.json(formatVendor(vendor));
  } catch (error) {
    console.error("💥 [Vendors] Error updating vendor:", error);
    return c.json({ error: "Failed to update vendor" }, 500);
  }
});

// DELETE /api/vendors/:id - Delete vendor
vendorsRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`🏪 [Vendors] Deleting vendor ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const existing = await db.vendor.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    if (organizationId && existing.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    await db.vendor.delete({ where: { id } });

    console.log(`✅ [Vendors] Deleted vendor ${id}`);
    return c.json({ success: true, message: "Vendor deleted" });
  } catch (error) {
    console.error("💥 [Vendors] Error deleting vendor:", error);
    return c.json({ error: "Failed to delete vendor" }, 500);
  }
});

// GET /api/vendors/:id/products - Get vendor's linked products
vendorsRouter.get("/:id/products", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendor = await db.vendor.findUnique({ where: { id } });
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    if (organizationId && vendor.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    const products = await db.vendorProduct.findMany({
      where: { vendorId: id },
      include: { inventoryItem: true },
    });

    const formattedProducts: VendorProduct[] = products.map((p) => ({
      id: p.id,
      vendorId: p.vendorId,
      inventoryItemId: p.inventoryItemId,
      inventoryItem: {
        id: p.inventoryItem.id,
        name: p.inventoryItem.name,
        description: p.inventoryItem.description,
        imageUrl: p.inventoryItem.imageUrl,
        binNumber: p.inventoryItem.binNumber,
        rackNumber: p.inventoryItem.rackNumber,
        platform: p.inventoryItem.platform,
        status: p.inventoryItem.status as "pending" | "completed" | "sold",
        quantity: p.inventoryItem.quantity,
        parLevel: p.inventoryItem.parLevel,
        cost: p.inventoryItem.cost,
        soldAt: p.inventoryItem.soldAt?.toISOString() ?? null,
        soldPrice: p.inventoryItem.soldPrice,
        shipByDate: p.inventoryItem.shipByDate?.toISOString() ?? null,
        shipperQrCode: p.inventoryItem.shipperQrCode,
        createdAt: p.inventoryItem.createdAt.toISOString(),
        updatedAt: p.inventoryItem.updatedAt.toISOString(),
      },
      vendorSku: p.vendorSku,
      unitCost: p.unitCost,
      minOrderQty: p.minOrderQty,
    }));

    return c.json({ products: formattedProducts } satisfies GetVendorProductsResponse);
  } catch (error) {
    console.error("💥 [Vendors] Error fetching vendor products:", error);
    return c.json({ error: "Failed to fetch vendor products" }, 500);
  }
});

// POST /api/vendors/:id/products - Link product to vendor
vendorsRouter.post("/:id/products", zValidator("json", linkVendorProductSchema), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`🏪 [Vendors] Linking product ${data.inventoryItemId} to vendor ${id}`);

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendor = await db.vendor.findUnique({ where: { id } });
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    if (organizationId && vendor.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    // Check if already linked
    const existing = await db.vendorProduct.findUnique({
      where: {
        vendorId_inventoryItemId: {
          vendorId: id,
          inventoryItemId: data.inventoryItemId,
        },
      },
    });

    if (existing) {
      // Update existing link
      const updated = await db.vendorProduct.update({
        where: { id: existing.id },
        data: {
          vendorSku: data.vendorSku ?? existing.vendorSku,
          unitCost: data.unitCost ?? existing.unitCost,
          minOrderQty: data.minOrderQty ?? existing.minOrderQty,
        },
      });
      return c.json({ id: updated.id, message: "Product link updated" });
    }

    const link = await db.vendorProduct.create({
      data: {
        vendorId: id,
        inventoryItemId: data.inventoryItemId,
        vendorSku: data.vendorSku ?? null,
        unitCost: data.unitCost ?? null,
        minOrderQty: data.minOrderQty ?? null,
      },
    });

    console.log(`✅ [Vendors] Linked product ${data.inventoryItemId} to vendor ${id}`);
    return c.json({ id: link.id, message: "Product linked to vendor" }, 201);
  } catch (error) {
    console.error("💥 [Vendors] Error linking product:", error);
    return c.json({ error: "Failed to link product" }, 500);
  }
});

// DELETE /api/vendors/:id/products/:productId - Unlink product from vendor
vendorsRouter.delete("/:id/products/:productId", async (c) => {
  const { id, productId } = c.req.param();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const organizationId = await getUserOrganizationId(user.id);

    const vendor = await db.vendor.findUnique({ where: { id } });
    if (!vendor) {
      return c.json({ error: "Vendor not found" }, 404);
    }
    if (organizationId && vendor.organizationId !== organizationId) {
      return c.json({ error: "Vendor not found" }, 404);
    }

    await db.vendorProduct.delete({ where: { id: productId } });

    return c.json({ success: true });
  } catch (error) {
    console.error("💥 [Vendors] Error unlinking product:", error);
    return c.json({ error: "Failed to unlink product" }, 500);
  }
});

export { vendorsRouter };
