import { buildApp } from "./app.js";
import { loadConfig } from "./config/index.js";

async function main() {
  const config = loadConfig();
  const app = await buildApp(undefined, config);

  // Graceful shutdown handling
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info({ signal }, "Received shutdown signal, closing server gracefully...");
      try {
        await app.close();
        app.log.info("Server closed successfully");
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, "Error during server close");
        process.exit(1);
      }
    });
  }

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    app.log.info(
      {
        address,
        port: config.port,
        env: config.nodeEnv,
        apiPrefix: config.apiPrefix,
      },
      "IRLG Backend Server started successfully"
    );
  } catch (err) {
    app.log.fatal({ err }, "Fatal error during server startup");
    process.exit(1);
  }
}

// Only execute automatically when run directly
if (process.env.NODE_ENV !== "test") {
  main();
}
