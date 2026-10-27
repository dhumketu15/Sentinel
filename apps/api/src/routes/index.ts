import { Router } from "express";
import { foundationRouter } from "./foundation.js";

export const apiRouter = Router();
apiRouter.use(foundationRouter);
