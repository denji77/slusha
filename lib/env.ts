// In lib/env.ts
const requiredVars = ['TELEGRAM_BOT_TOKEN', 'AI_TOKEN', /* other CRITICAL vars */];
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
    console.error('One or more critical environment variables are missing. Bot may not start correctly or at all.');
    // Deno.exit(1); // If you uncommented this, the deployment would fail and Vercel would show it.
}