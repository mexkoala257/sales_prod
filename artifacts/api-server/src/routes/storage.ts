import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requireStoreAdmin, type JwtPayload } from "../middlewares/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { getSetting } from "../lib/settings";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function publicProductImageUrl(req: Request, objectPath: string): string {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const objectId = objectPath.replace(/^\/objects\//, "");
  return `${protocol}://${req.get("host")}/api/storage/product-images/${objectId}`;
}

router.post(
  "/storage/product-images/request-url",
  requireStoreAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { name, contentType, size } = req.body as { name?: string; contentType?: string; size?: number };
    if (!name || !contentType || !/^image\/(?:jpeg|png|webp|gif)$/i.test(contentType)) {
      res.status(400).json({ error: "A JPEG, PNG, WebP, or GIF image is required." });
      return;
    }
    if (typeof size === "number" && size > 10 * 1024 * 1024) {
      res.status(413).json({ error: "Product images must be 10 MB or smaller." });
      return;
    }
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = await objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, publicUrl: publicProductImageUrl(req, objectPath), metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, "Error generating product image upload URL");
      res.status(500).json({ error: "Failed to generate product image upload URL" });
    }
  },
);

router.post(
  "/storage/product-images/finalize",
  requireStoreAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { objectPath } = req.body as { objectPath?: string };
    if (!objectPath?.startsWith("/objects/uploads/")) {
      res.status(400).json({ error: "Invalid product image object path." });
      return;
    }
    try {
      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: String(((req as any).user as JwtPayload | undefined)?.id ?? "store-admin"),
        visibility: "public",
      });
      res.json({ objectPath, publicUrl: publicProductImageUrl(req, objectPath) });
    } catch (error) {
      req.log.error({ err: error }, "Error finalizing product image upload");
      res.status(500).json({ error: "Failed to finalize product image upload" });
    }
  },
);

router.get("/storage/product-images/*path", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.path;
    const objectPath = `/objects/uploads/${Array.isArray(raw) ? raw.join("/") : raw}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const isPublic = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!isPublic) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving product image");
    res.status(500).json({ error: "Failed to serve product image" });
  }
});

/**
 * POST /storage/uploads/request-url
 * Request a presigned URL for file upload. Requires JWT auth.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const enabled = await getSetting("featureArtworkUploads", "true");
    if (enabled === "false") {
      res.status(403).json({ error: "Artwork uploads are currently disabled." });
      return;
    }

    const { name, contentType } = req.body as { name?: string; contentType?: string; size?: number };
    if (!name || !contentType) {
      res.status(400).json({ error: "name and contentType are required" });
      return;
    }

    try {
      const size = req.body.size;
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = await objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS — no auth required.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 * Serve uploaded objects. Requires JWT auth.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
