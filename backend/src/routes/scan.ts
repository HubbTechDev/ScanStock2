import { Hono } from "hono";
import db from "../db";

export const scanRoutes = new Hono();

scanRoutes.post("/start", async (c) => {
  try {
    let user = await db.user.findFirst();

    if (!user) {
      user = await db.user.create({
        data: {
          id: "dev-user",
          name: "Dev Test",
          email: "dev@scanstock.local",
        },
      });
    }

    const scan = await db.scanSession.create({
      data: {
        userId: user.id,
        status: "uploaded",
      },
    });

    return c.json(scan);
  } catch (err) {
    console.error("[scan/start] error:", err);
    return c.json({ error: "Scan start failed", details: String(err) }, 500);
  }
});

scanRoutes.post("/:scanId/upload", async (c) => {
  try {
    const scanId = c.req.param("scanId");
    const body = await c.req.parseBody();

    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const filename = `${scanId}-${Date.now()}.jpg`;
    const filePath = `uploads/${filename}`;

    await Bun.write(filePath, file);

    const scan = await db.scanSession.update({
      where: { id: scanId },
      data: {
        imageUrl: `/${filePath}`,
        status: "processing",
      },
    });

    return c.json(scan);
  } catch (err) {
    console.error("[scan/upload] error:", err);
    return c.json({ error: "Upload failed", details: String(err) }, 500);
  }
});

scanRoutes.post("/:scanId/run", async (c) => {
  try {
    const scanId = c.req.param("scanId");

    const scan = await db.scanSession.findUnique({
      where: { id: scanId },
    });

    if (!scan) return c.json({ error: "ScanSession not found" }, 404);
    if (!scan.imageUrl) return c.json({ error: "No image uploaded yet" }, 400);

    // TEMP stub (AI later)
    const resultsFromAi = [
      { label: "t-shirt", count: 3, confidence: 0.78 },
      { label: "toy", count: 2, confidence: 0.72 },
    ];

    await db.scanResult.deleteMany({
      where: { scanSessionId: scanId },
    });

    await db.scanResult.createMany({
      data: resultsFromAi.map((r) => ({
        scanSessionId: scanId,
        label: r.label,
        count: r.count,
        confidence: r.confidence ?? null,
      })),
    });

    const updated = await db.scanSession.update({
      where: { id: scanId },
      data: { status: "done" },
    });

    const results = await db.scanResult.findMany({
      where: { scanSessionId: scanId },
      orderBy: { label: "asc" },
    });

    return c.json({ scan: updated, results, file: scan.imageUrl });
  } catch (err) {
    console.error("[scan/run] error:", err);
    return c.json({ error: "Run scan failed", details: String(err) }, 500);
  }
});
