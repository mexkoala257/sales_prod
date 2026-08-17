import { Router, type IRouter } from "express";
import { getSetting } from "../lib/settings";

const router: IRouter = Router();

/**
 * GET /feature-flags
 * Returns public feature flag states. No auth required — used by the
 * storefront frontend to decide whether to show "Coming Soon" states.
 */
router.get("/feature-flags", async (_req, res): Promise<void> => {
  const [b2bPortal, b2cStorefront, artworkUploads] = await Promise.all([
    getSetting("featureB2BPortal", "true"),
    getSetting("featureB2CStorefront", "true"),
    getSetting("featureArtworkUploads", "true"),
  ]);

  res.json({
    featureB2BPortal: b2bPortal !== "false",
    featureB2CStorefront: b2cStorefront !== "false",
    featureArtworkUploads: artworkUploads !== "false",
  });
});

export default router;
