import * as log from "https://deno.land/std@0.192.0/log/mod.ts";

await log.setup({
  handlers: {
    file: new log.handlers.FileHandler("INFO", {
      filename: "./log/app.log",
      formatter: "{levelName} {msg}",
    }),
  },
  loggers: {
    default: {
      level: "INFO",
      handlers: ["file"],
    },
  },
});

export default log;
