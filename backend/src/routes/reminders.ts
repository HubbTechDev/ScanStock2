import { Hono } from "hono";
import { db } from "../db";
import { type AppType } from "../types";
import {
  createReminderSchema,
  updateReminderSchema,
} from "@/shared/contracts";

const app = new Hono<AppType>();

// GET /api/reminders/upcoming - Get all upcoming reminders
app.get("/upcoming", async (c) => {
  try {
    const reminders = await db.reminder.findMany({
      where: {
        isCompleted: false,
        reminderDate: {
          gte: new Date(),
        },
      },
      include: {
        item: true,
      },
      orderBy: {
        reminderDate: "asc",
      },
    });

    return c.json({
      reminders: reminders.map((r) => ({
        ...r,
        reminderDate: r.reminderDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        item: {
          ...r.item,
          soldAt: r.item.soldAt?.toISOString() ?? null,
          shipByDate: r.item.shipByDate?.toISOString() ?? null,
          createdAt: r.item.createdAt.toISOString(),
          updatedAt: r.item.updatedAt.toISOString(),
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching upcoming reminders:", error);
    return c.json({ error: "Failed to fetch reminders" }, 500);
  }
});

// GET /api/reminders/item/:itemId - Get reminders for a specific item
app.get("/item/:itemId", async (c) => {
  try {
    const { itemId } = c.req.param();

    const reminders = await db.reminder.findMany({
      where: { itemId },
      orderBy: { reminderDate: "asc" },
    });

    return c.json({
      reminders: reminders.map((r) => ({
        ...r,
        reminderDate: r.reminderDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching item reminders:", error);
    return c.json({ error: "Failed to fetch reminders" }, 500);
  }
});

// POST /api/reminders - Create a reminder
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validation = createReminderSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.message }, 400);
    }

    const { itemId, reminderDate, note, notificationId } = validation.data;

    // Verify item exists
    const item = await db.inventoryItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return c.json({ error: "Item not found" }, 404);
    }

    const reminder = await db.reminder.create({
      data: {
        itemId,
        reminderDate: new Date(reminderDate),
        note: note ?? null,
        notificationId: notificationId ?? null,
      },
    });

    return c.json({
      ...reminder,
      reminderDate: reminder.reminderDate.toISOString(),
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    }, 201);
  } catch (error) {
    console.error("Error creating reminder:", error);
    return c.json({ error: "Failed to create reminder" }, 500);
  }
});

// PATCH /api/reminders/:id - Update a reminder
app.patch("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const validation = updateReminderSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.message }, 400);
    }

    const { reminderDate, note, isCompleted, notificationId } = validation.data;

    const reminder = await db.reminder.update({
      where: { id },
      data: {
        ...(reminderDate && { reminderDate: new Date(reminderDate) }),
        ...(note !== undefined && { note }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(notificationId !== undefined && { notificationId }),
      },
    });

    return c.json({
      ...reminder,
      reminderDate: reminder.reminderDate.toISOString(),
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating reminder:", error);
    return c.json({ error: "Failed to update reminder" }, 500);
  }
});

// DELETE /api/reminders/:id - Delete a reminder
app.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    await db.reminder.delete({
      where: { id },
    });

    return c.json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    return c.json({ error: "Failed to delete reminder" }, 500);
  }
});

export default app;
