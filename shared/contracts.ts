// contracts.ts
// Shared API contracts (schemas and types) used by both the server and the app.
// Import in the app as: `import { type GetSampleResponse } from "@shared/contracts"`
// Import in the server as: `import { postSampleRequestSchema } from "@shared/contracts"`

import { z } from "zod";

// GET /api/sample
export const getSampleResponseSchema = z.object({
  message: z.string(),
});
export type GetSampleResponse = z.infer<typeof getSampleResponseSchema>;

// POST /api/sample
export const postSampleRequestSchema = z.object({
  value: z.string(),
});
export type PostSampleRequest = z.infer<typeof postSampleRequestSchema>;
export const postSampleResponseSchema = z.object({
  message: z.string(),
});
export type PostSampleResponse = z.infer<typeof postSampleResponseSchema>;

// POST /api/upload/image
export const uploadImageRequestSchema = z.object({
  image: z.instanceof(File),
});
export type UploadImageRequest = z.infer<typeof uploadImageRequestSchema>;
export const uploadImageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string(),
  filename: z.string(),
});
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;

// ============================================
// Inventory Item Types
// ============================================

export const inventoryStatusSchema = z.enum(["pending", "completed", "sold"]);
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;

export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string(),
  binNumber: z.string(),
  rackNumber: z.string(),
  platform: z.string(),
  status: inventoryStatusSchema,
  quantity: z.number(),
  parLevel: z.number().nullable(),
  cost: z.number().nullable(),
  soldAt: z.string().nullable(),
  soldPrice: z.number().nullable(),
  shipByDate: z.string().nullable(),
  shipperQrCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

// GET /api/inventory - Get all inventory items
export const getInventoryResponseSchema = z.object({
  items: z.array(inventoryItemSchema),
  stats: z.object({
    total: z.number(),
    pending: z.number(),
    completed: z.number(),
    sold: z.number(),
  }),
});
export type GetInventoryResponse = z.infer<typeof getInventoryResponseSchema>;

// GET /api/inventory/:id - Get single inventory item
export type GetInventoryItemResponse = InventoryItem;

// POST /api/inventory - Create inventory item
export const createInventoryItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string(),
  binNumber: z.string().optional(),
  rackNumber: z.string().optional(),
  platform: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  parLevel: z.number().int().min(0).nullable().optional(),
  cost: z.number().optional(),
  status: inventoryStatusSchema.optional(),
});
export type CreateInventoryItemRequest = z.infer<typeof createInventoryItemSchema>;
export type CreateInventoryItemResponse = InventoryItem;

// PATCH /api/inventory/:id - Update inventory item
export const updateInventoryItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  binNumber: z.string().min(1).optional(),
  rackNumber: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  parLevel: z.number().int().min(0).nullable().optional(),
  cost: z.number().optional(),
  status: inventoryStatusSchema.optional(),
  soldPrice: z.number().optional(),
  shipByDate: z.string().nullable().optional(),
  shipperQrCode: z.string().nullable().optional(),
});
export type UpdateInventoryItemRequest = z.infer<typeof updateInventoryItemSchema>;
export type UpdateInventoryItemResponse = InventoryItem;

// DELETE /api/inventory/:id - Delete inventory item
export const deleteInventoryItemResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteInventoryItemResponse = z.infer<typeof deleteInventoryItemResponseSchema>;

// POST /api/inventory/search - Search inventory by image (returns matching items)
export const searchInventoryRequestSchema = z.object({
  query: z.string().optional(),
  status: inventoryStatusSchema.optional(),
});
export type SearchInventoryRequest = z.infer<typeof searchInventoryRequestSchema>;
export type SearchInventoryResponse = InventoryItem[];

// POST /api/inventory/search-by-photo - Search inventory by photo
export const searchByPhotoRequestSchema = z.object({
  image: z.string(), // Base64 encoded image
  itemIds: z.array(z.string()), // Item IDs to search within
});
export type SearchByPhotoRequest = z.infer<typeof searchByPhotoRequestSchema>;

export const searchByPhotoResponseSchema = z.object({
  matchingItemIds: z.array(z.string()),
});
export type SearchByPhotoResponse = z.infer<typeof searchByPhotoResponseSchema>;

// ============================================
// Import/Scrape Types
// ============================================

export const platformTypeSchema = z.enum(['mercari', 'depop']);
export type PlatformType = z.infer<typeof platformTypeSchema>;

export const scrapedListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.string(),
  imageUrl: z.string(),
  description: z.string(),
  itemUrl: z.string(),
  status: z.enum(['available', 'sold']),
});
export type ScrapedListing = z.infer<typeof scrapedListingSchema>;

// POST /api/import/scrape - Scrape listings from store page
export const scrapeRequestSchema = z.object({
  platform: platformTypeSchema,
  storeUrl: z.string(),
});
export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;

export const scrapeResponseSchema = z.object({
  success: z.boolean(),
  listings: z.array(scrapedListingSchema),
  storeName: z.string(),
  error: z.string().optional(),
});
export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>;

// ============================================
// Reminder Types
// ============================================

export const reminderSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  reminderDate: z.string(),
  note: z.string().nullable(),
  isCompleted: z.boolean(),
  notificationId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Reminder = z.infer<typeof reminderSchema>;

// GET /api/reminders/:itemId - Get reminders for an item
export const getRemindersResponseSchema = z.object({
  reminders: z.array(reminderSchema),
});
export type GetRemindersResponse = z.infer<typeof getRemindersResponseSchema>;

// POST /api/reminders - Create a reminder
export const createReminderSchema = z.object({
  itemId: z.string(),
  reminderDate: z.string(),
  note: z.string().optional(),
  notificationId: z.string().optional(),
});
export type CreateReminderRequest = z.infer<typeof createReminderSchema>;
export type CreateReminderResponse = Reminder;

// PATCH /api/reminders/:id - Update a reminder
export const updateReminderSchema = z.object({
  reminderDate: z.string().optional(),
  note: z.string().optional(),
  isCompleted: z.boolean().optional(),
  notificationId: z.string().nullable().optional(),
});
export type UpdateReminderRequest = z.infer<typeof updateReminderSchema>;
export type UpdateReminderResponse = Reminder;

// DELETE /api/reminders/:id - Delete a reminder
export const deleteReminderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteReminderResponse = z.infer<typeof deleteReminderResponseSchema>;

// GET /api/reminders/upcoming - Get all upcoming reminders
export const getUpcomingRemindersResponseSchema = z.object({
  reminders: z.array(reminderSchema.extend({
    item: inventoryItemSchema,
  })),
});
export type GetUpcomingRemindersResponse = z.infer<typeof getUpcomingRemindersResponseSchema>;

// ============================================
// Prep Sheet Types (Restaurant Industry)
// ============================================

export const prepUnitSchema = z.enum([
  "each",
  "pint",
  "quart",
  "gallon",
  "pan",
  "half_pan",
  "third_pan",
  "sixth_pan",
  "lb",
  "oz",
  "kg",
  "g",
  "cup",
  "tbsp",
  "tsp",
  "dozen",
  "case",
  "bag",
  "box",
  "bottle",
  "bunch",
  "head",
  "slice",
  "portion",
]);
export type PrepUnit = z.infer<typeof prepUnitSchema>;

export const prepItemTypeSchema = z.enum(["ingredient", "prepped"]);
export type PrepItemType = z.infer<typeof prepItemTypeSchema>;

export const prepItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  itemType: prepItemTypeSchema,
  parLevel: z.number(),
  currentLevel: z.number(),
  unit: prepUnitSchema,
  notes: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PrepItem = z.infer<typeof prepItemSchema>;

export const prepLogSchema = z.object({
  id: z.string(),
  prepItemId: z.string(),
  quantityPrepped: z.number(),
  preppedBy: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type PrepLog = z.infer<typeof prepLogSchema>;

// GET /api/prep-items - Get all prep items
export const getPrepItemsResponseSchema = z.object({
  items: z.array(prepItemSchema),
});
export type GetPrepItemsResponse = z.infer<typeof getPrepItemsResponseSchema>;

// GET /api/prep-items/:id - Get single prep item
export type GetPrepItemResponse = PrepItem;

// POST /api/prep-items - Create prep item
export const createPrepItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  itemType: prepItemTypeSchema.optional().default("ingredient"),
  parLevel: z.number().min(0),
  currentLevel: z.number().min(0).optional(),
  unit: prepUnitSchema,
  notes: z.string().optional(),
  sortOrder: z.number().optional(),
});
export type CreatePrepItemRequest = z.infer<typeof createPrepItemSchema>;
export type CreatePrepItemResponse = PrepItem;

// PATCH /api/prep-items/:id - Update prep item
export const updatePrepItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  parLevel: z.number().min(0).optional(),
  currentLevel: z.number().min(0).optional(),
  unit: prepUnitSchema.optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePrepItemRequest = z.infer<typeof updatePrepItemSchema>;
export type UpdatePrepItemResponse = PrepItem;

// DELETE /api/prep-items/:id - Delete prep item
export const deletePrepItemResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeletePrepItemResponse = z.infer<typeof deletePrepItemResponseSchema>;

// POST /api/prep-items/:id/log - Log prep completion
export const createPrepLogSchema = z.object({
  quantityPrepped: z.number().min(0),
  preppedBy: z.string().optional(),
  notes: z.string().optional(),
});
export type CreatePrepLogRequest = z.infer<typeof createPrepLogSchema>;
export type CreatePrepLogResponse = PrepLog;

// GET /api/prep-items/:id/logs - Get prep logs for an item
export const getPrepLogsResponseSchema = z.object({
  logs: z.array(prepLogSchema),
});
export type GetPrepLogsResponse = z.infer<typeof getPrepLogsResponseSchema>;

// POST /api/prep-items/update-levels - Batch update current levels
export const batchUpdateLevelsSchema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    currentLevel: z.number().min(0),
  })),
});
export type BatchUpdateLevelsRequest = z.infer<typeof batchUpdateLevelsSchema>;
export type BatchUpdateLevelsResponse = { success: boolean; updatedCount: number };

// ============================================
// Cycle Count Types
// ============================================

export const cycleCountStatusSchema = z.enum(["in_progress", "completed", "cancelled"]);
export type CycleCountStatus = z.infer<typeof cycleCountStatusSchema>;

export const cycleCountItemSchema = z.object({
  id: z.string(),
  cycleCountId: z.string(),
  inventoryItemId: z.string(),
  expectedQty: z.number(),
  countedQty: z.number().nullable(),
  variance: z.number().nullable(),
  notes: z.string().nullable(),
  countedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Include inventory item details for display
  inventoryItem: z.object({
    id: z.string(),
    name: z.string(),
    imageUrl: z.string(),
    binNumber: z.string(),
    rackNumber: z.string(),
  }).optional(),
});
export type CycleCountItem = z.infer<typeof cycleCountItemSchema>;

export const cycleCountSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: cycleCountStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Stats
  totalItems: z.number().optional(),
  countedItems: z.number().optional(),
  itemsWithVariance: z.number().optional(),
});
export type CycleCount = z.infer<typeof cycleCountSchema>;

// GET /api/cycle-counts - Get all cycle counts
export const getCycleCountsResponseSchema = z.object({
  cycleCounts: z.array(cycleCountSchema),
});
export type GetCycleCountsResponse = z.infer<typeof getCycleCountsResponseSchema>;

// GET /api/cycle-counts/:id - Get single cycle count with items
export const getCycleCountResponseSchema = cycleCountSchema.extend({
  items: z.array(cycleCountItemSchema),
});
export type GetCycleCountResponse = z.infer<typeof getCycleCountResponseSchema>;

// POST /api/cycle-counts - Create new cycle count
export const createCycleCountSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});
export type CreateCycleCountRequest = z.infer<typeof createCycleCountSchema>;
export type CreateCycleCountResponse = CycleCount;

// PATCH /api/cycle-counts/:id - Update cycle count
export const updateCycleCountSchema = z.object({
  name: z.string().min(1).optional(),
  status: cycleCountStatusSchema.optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateCycleCountRequest = z.infer<typeof updateCycleCountSchema>;
export type UpdateCycleCountResponse = CycleCount;

// POST /api/cycle-counts/:id/items/:itemId/count - Record a count for an item
export const recordCountSchema = z.object({
  countedQty: z.number().int().min(0),
  notes: z.string().optional(),
});
export type RecordCountRequest = z.infer<typeof recordCountSchema>;
export type RecordCountResponse = CycleCountItem;

// POST /api/cycle-counts/:id/complete - Complete and apply cycle count
export const completeCycleCountSchema = z.object({
  applyChanges: z.boolean().default(true), // Whether to update inventory quantities
});
export type CompleteCycleCountRequest = z.infer<typeof completeCycleCountSchema>;
export type CompleteCycleCountResponse = CycleCount;

// DELETE /api/cycle-counts/:id - Delete/cancel cycle count
export const deleteCycleCountResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteCycleCountResponse = z.infer<typeof deleteCycleCountResponseSchema>;

// ==================== VENDORS ====================

export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Vendor = z.infer<typeof vendorSchema>;

// GET /api/vendors - List vendors
export type GetVendorsResponse = {
  vendors: Vendor[];
};

// POST /api/vendors - Create vendor
export const createVendorSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateVendorRequest = z.infer<typeof createVendorSchema>;
export type CreateVendorResponse = Vendor;

// PATCH /api/vendors/:id - Update vendor
export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
export type UpdateVendorRequest = z.infer<typeof updateVendorSchema>;
export type UpdateVendorResponse = Vendor;

// DELETE /api/vendors/:id - Delete vendor
export type DeleteVendorResponse = { success: boolean; message: string };

// POST /api/vendors/:id/products - Link product to vendor
export const linkVendorProductSchema = z.object({
  inventoryItemId: z.string(),
  vendorSku: z.string().optional(),
  unitCost: z.number().optional(),
  minOrderQty: z.number().int().optional(),
});
export type LinkVendorProductRequest = z.infer<typeof linkVendorProductSchema>;

// GET /api/vendors/:id/products - Get vendor's products
export type VendorProduct = {
  id: string;
  vendorId: string;
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  vendorSku: string | null;
  unitCost: number | null;
  minOrderQty: number | null;
};
export type GetVendorProductsResponse = {
  products: VendorProduct[];
};

// ==================== ORDERS ====================

export const orderStatusSchema = z.enum(['draft', 'submitted', 'received', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  inventoryItemId: z.string(),
  inventoryItem: inventoryItemSchema.optional(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  totalCost: z.number().nullable(),
  notes: z.string().nullable(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  vendorId: z.string(),
  vendor: vendorSchema.optional(),
  status: orderStatusSchema,
  notes: z.string().nullable(),
  submittedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  totalAmount: z.number().nullable(),
  items: z.array(orderItemSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;

// GET /api/orders - List orders
export type GetOrdersResponse = {
  orders: Order[];
};

// POST /api/orders - Create order
export const createOrderSchema = z.object({
  vendorId: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    inventoryItemId: z.string(),
    quantity: z.number().int().min(1),
    unitCost: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
export type CreateOrderResponse = Order;

// PATCH /api/orders/:id - Update order
export const updateOrderSchema = z.object({
  notes: z.string().optional(),
  status: orderStatusSchema.optional(),
});
export type UpdateOrderRequest = z.infer<typeof updateOrderSchema>;
export type UpdateOrderResponse = Order;

// POST /api/orders/:id/items - Add item to order
export const addOrderItemSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().int().min(1),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
});
export type AddOrderItemRequest = z.infer<typeof addOrderItemSchema>;
export type AddOrderItemResponse = OrderItem;

// PATCH /api/orders/:id/items/:itemId - Update order item
export const updateOrderItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
});
export type UpdateOrderItemRequest = z.infer<typeof updateOrderItemSchema>;

// DELETE /api/orders/:id/items/:itemId - Remove item from order
export type DeleteOrderItemResponse = { success: boolean };

// POST /api/orders/:id/submit - Submit order
export type SubmitOrderResponse = Order;

// POST /api/orders/:id/receive - Mark order as received
export const receiveOrderSchema = z.object({
  updateInventory: z.boolean().default(true),
});
export type ReceiveOrderRequest = z.infer<typeof receiveOrderSchema>;
export type ReceiveOrderResponse = Order;

// DELETE /api/orders/:id - Delete/cancel order
export type DeleteOrderResponse = { success: boolean; message: string };

// GET /api/orders/below-par - Get items below par level for a vendor
export type GetBelowParItemsResponse = {
  items: Array<{
    inventoryItem: InventoryItem;
    vendorProduct: VendorProduct | null;
    currentQty: number;
    parLevel: number;
    orderQty: number; // Suggested quantity to order (parLevel - currentQty)
  }>;
};
