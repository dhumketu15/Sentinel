import { Router } from "express";
import { foundationRouter } from "./foundation.js";
import { brandsRouter } from "./brands.js";
import { auditsRouter } from "./audits.js";
import { analyticsRouter } from "./analytics.js";
import { surveysRouter } from "./surveys.js";

export const apiRouter = Router();
apiRouter.use(foundationRouter);
apiRouter.use(brandsRouter);
apiRouter.use(auditsRouter);
apiRouter.use(analyticsRouter);
apiRouter.use(surveysRouter);
