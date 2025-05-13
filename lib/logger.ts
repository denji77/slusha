// lib/logger.ts
import * as log from 'jsr:@deno-library/logger@^1.1.9'; // Import all exports under the 'log' namespace

console.log("LOGGER.TS: Module start.");
let exportedLogger: log.Logger; // Use the Logger type from the module

try {
    console.log("LOGGER.TS: Attempting log.setup()...");
    await log.setup({ // Use log.setup
        handlers: {
            console: new log.ConsoleHandler('DEBUG'), // Use log.ConsoleHandler
            file: new log.FileHandler('INFO', {      // Use log.FileHandler
                filename: './log/app.log',
                formatter: (logRecord: log.LogRecord) => { // Use log.LogRecord type
                    return `[${logRecord.datetime.toISOString()}] ${logRecord.levelName} ${logRecord.msg}`;
                },
            }),
        },
        loggers: {
            default: {
                level: 'DEBUG',
                handlers: ['console', 'file'],
            },
        },
    });
    console.log("LOGGER.TS: log.setup() completed.");
    exportedLogger = log.getLogger(); // Use log.getLogger
    if (typeof exportedLogger?.info !== 'function') {
        console.error("LOGGER.TS CRITICAL: log.getLogger() did not return a valid logger with an info method!");
        throw new Error("Logger initialization failed: log.getLogger() returned invalid object.");
    }
    // Test the logger immediately after initialization
    exportedLogger.info("LOGGER.TS: Logger successfully initialized from logger.ts. This is a test log.");

} catch (err) {
    console.error("LOGGER.TS FATAL: log.setup() or getLogger() failed:", err.message, err.stack);
    // Fallback to prevent "cannot read property 'info' of undefined"
    // but the application is essentially broken if the real logger fails.
    exportedLogger = { // Provide a minimal fallback
        info: (msg: any, ...args: any[]) => console.log("!!! FALLBACK LOGGER (info) !!!:", msg, ...args),
        warn: (msg: any, ...args: any[]) => console.warn("!!! FALLBACK LOGGER (warn) !!!:", msg, ...args),
        error: (msg: any, ...args: any[]) => console.error("!!! FALLBACK LOGGER (error) !!!:", msg, ...args),
        debug: (msg: any, ...args: any[]) => console.log("!!! FALLBACK LOGGER (debug) !!!:", msg, ...args),
        critical: (msg: any, ...args: any[]) => console.error("!!! FALLBACK LOGGER (critical) !!!:", msg, ...args),
        // Add other methods if your code uses them, or type it as 'any' for the fallback
    } as any; // Cast to any if the fallback doesn't match Logger type fully
    // Consider Deno.exit(1) here if logger is absolutely essential for any operation
}

console.log("LOGGER.TS: Module end, exporting logger.");
export default exportedLogger;