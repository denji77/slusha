import { Logger } from "https://deno.land/x/logger@1.2.0/mod.ts";

const logger = new Logger();
await logger.initFileLogger('log', { rotate: true });

export default logger;
