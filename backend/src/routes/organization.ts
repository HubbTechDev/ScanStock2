import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { type AppType } from "../types";
import { db } from "../db";

const organizationRouter = new Hono<AppType>();

// Generate a random 6-character invite code
const generateInviteCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars like 0/O, 1/I/L
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// GET /api/organization - Get user's current organization
organizationRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`🏢 [Organization] Fetching organization for user ${user.id}`);

  try {
    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      console.log(`❌ [Organization] User ${user.id} has no organization`);
      return c.json({ organization: null });
    }

    const org = membership.organization;
    console.log(`✅ [Organization] Found organization ${org.name} for user ${user.id}`);

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        inviteCode: org.inviteCode,
        role: membership.role,
        members: org.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        })),
        createdAt: org.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 [Organization] Error fetching organization:", error);
    return c.json({ error: "Failed to fetch organization" }, 500);
  }
});

// POST /api/organization - Create a new organization
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

organizationRouter.post("/", zValidator("json", createOrgSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { name } = c.req.valid("json");
  console.log(`🏢 [Organization] Creating organization "${name}" for user ${user.id}`);

  try {
    // Check if user already has an organization
    const existingMembership = await db.organizationMember.findFirst({
      where: { userId: user.id },
    });

    if (existingMembership) {
      console.log(`❌ [Organization] User ${user.id} already in an organization`);
      return c.json({ error: "You are already part of an organization" }, 400);
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.organization.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create organization and add user as owner
    const org = await db.organization.create({
      data: {
        name,
        inviteCode,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    console.log(`✅ [Organization] Created organization ${org.id} with code ${inviteCode}`);

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        inviteCode: org.inviteCode,
        role: "owner",
        members: org.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        })),
        createdAt: org.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 [Organization] Error creating organization:", error);
    return c.json({ error: "Failed to create organization" }, 500);
  }
});

// POST /api/organization/join - Join an organization via invite code
const joinOrgSchema = z.object({
  inviteCode: z.string().length(6),
});

organizationRouter.post("/join", zValidator("json", joinOrgSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { inviteCode } = c.req.valid("json");
  console.log(`🏢 [Organization] User ${user.id} attempting to join with code ${inviteCode}`);

  try {
    // Check if user already has an organization
    const existingMembership = await db.organizationMember.findFirst({
      where: { userId: user.id },
    });

    if (existingMembership) {
      console.log(`❌ [Organization] User ${user.id} already in an organization`);
      return c.json({ error: "You are already part of an organization. Leave first to join another." }, 400);
    }

    // Find organization by invite code
    const org = await db.organization.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!org) {
      console.log(`❌ [Organization] Invalid invite code ${inviteCode}`);
      return c.json({ error: "Invalid invite code" }, 404);
    }

    // Add user to organization
    await db.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "member",
      },
    });

    // Fetch updated organization
    const updatedOrg = await db.organization.findUnique({
      where: { id: org.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    console.log(`✅ [Organization] User ${user.id} joined organization ${org.name}`);

    return c.json({
      organization: {
        id: updatedOrg!.id,
        name: updatedOrg!.name,
        inviteCode: updatedOrg!.inviteCode,
        role: "member",
        members: updatedOrg!.members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          joinedAt: m.createdAt.toISOString(),
        })),
        createdAt: updatedOrg!.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 [Organization] Error joining organization:", error);
    return c.json({ error: "Failed to join organization" }, 500);
  }
});

// POST /api/organization/leave - Leave current organization
organizationRouter.post("/leave", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`🏢 [Organization] User ${user.id} leaving organization`);

  try {
    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!membership) {
      return c.json({ error: "You are not part of any organization" }, 400);
    }

    // Check if user is the only owner
    if (membership.role === "owner") {
      const otherOwners = membership.organization.members.filter(
        (m) => m.role === "owner" && m.userId !== user.id
      );
      if (otherOwners.length === 0 && membership.organization.members.length > 1) {
        return c.json({ error: "You must transfer ownership before leaving" }, 400);
      }
    }

    // If user is the only member, delete the organization
    if (membership.organization.members.length === 1) {
      await db.organization.delete({
        where: { id: membership.organizationId },
      });
      console.log(`✅ [Organization] Deleted empty organization ${membership.organizationId}`);
    } else {
      await db.organizationMember.delete({
        where: { id: membership.id },
      });
      console.log(`✅ [Organization] User ${user.id} left organization`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("💥 [Organization] Error leaving organization:", error);
    return c.json({ error: "Failed to leave organization" }, 500);
  }
});

// PATCH /api/organization - Update organization (owner/admin only)
const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

organizationRouter.patch("/", zValidator("json", updateOrgSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const data = c.req.valid("json");
  console.log(`🏢 [Organization] Updating organization for user ${user.id}`);

  try {
    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id },
    });

    if (!membership) {
      return c.json({ error: "You are not part of any organization" }, 400);
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return c.json({ error: "Only owners and admins can update the organization" }, 403);
    }

    const org = await db.organization.update({
      where: { id: membership.organizationId },
      data,
    });

    console.log(`✅ [Organization] Updated organization ${org.id}`);

    return c.json({
      id: org.id,
      name: org.name,
      inviteCode: org.inviteCode,
    });
  } catch (error) {
    console.error("💥 [Organization] Error updating organization:", error);
    return c.json({ error: "Failed to update organization" }, 500);
  }
});

// POST /api/organization/regenerate-code - Generate new invite code (owner/admin only)
organizationRouter.post("/regenerate-code", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log(`🏢 [Organization] Regenerating invite code for user ${user.id}`);

  try {
    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id },
    });

    if (!membership) {
      return c.json({ error: "You are not part of any organization" }, 400);
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return c.json({ error: "Only owners and admins can regenerate the invite code" }, 403);
    }

    // Generate new unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.organization.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const org = await db.organization.update({
      where: { id: membership.organizationId },
      data: { inviteCode },
    });

    console.log(`✅ [Organization] New invite code: ${inviteCode}`);

    return c.json({ inviteCode: org.inviteCode });
  } catch (error) {
    console.error("💥 [Organization] Error regenerating invite code:", error);
    return c.json({ error: "Failed to regenerate invite code" }, 500);
  }
});

export { organizationRouter };
