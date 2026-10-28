import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import app from "./index.js";

app.listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT }, "BrandSentinel API listening");
});
