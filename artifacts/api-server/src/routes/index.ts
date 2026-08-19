import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import superAdminRouter from "./super-admin";
import adminRouter from "./admin";
import b2bRouter from "./b2b";
import storefrontRouter from "./storefront";
import featureFlagsRouter from "./feature-flags";
import shopifyRouter from "./shopify";
import shopifyOAuthRouter from "./shopify-oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(superAdminRouter);
router.use(adminRouter);
router.use(b2bRouter);
router.use(storefrontRouter);
router.use(featureFlagsRouter);
router.use(shopifyRouter);
router.use(shopifyOAuthRouter);

export default router;
