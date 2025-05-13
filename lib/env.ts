// lib/env.ts
/**
 * This module used to load environment variables from a .env file.
 * When deploying to environments like Vercel, environment variables
 * are typically set through the platform's dashboard and are directly
 * available via Deno.env.get(). Thus, loading from a local .env
 * file is often unnecessary or can be skipped in such environments.
 */

console.log(
    'Relying on environment variables set by the hosting platform (e.g., Vercel) or system environment.',
);

// You can add checks here for essential environment variables if needed:
const requiredVars = ['TELEGRAM_BOT_TOKEN', 'AI_TOKEN']; // Add your essential vars
let allVarsPresent = true;
for (const varName of requiredVars) {
    if (Deno.env.get(varName) === undefined) {
        console.error(
            `CRITICAL: Required environment variable "${varName}" is not set. Please set it in your Vercel project settings.`,
        );
        allVarsPresent = false;
    }
}

if (!allVarsPresent) {
    // Optionally, you might want to exit if critical variables are missing,
    // though Vercel might restart the deployment.
    // Consider how you want to handle this in a serverless environment.
    // For a long-running bot, exiting might be appropriate.
    console.error(
        'One or more critical environment variables are missing. Exiting.',
    );
    // Deno.exit(1); // Uncomment if you want the process to exit
}

// No need to export anything if it's just for the side effect of logging or checking.
// The top-level await for loadEnvFromFile() is removed.
// main.ts will just import this file for its side effects (the console logs and checks).