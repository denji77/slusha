import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

export async function loadEnv() {
    try {
        const env = await load({
            envPath: "./.env",
            export: true,
        });

        // Verify required environment variables
        const required = ["AI_TOKEN", "TELEGRAM_BOT_TOKEN"];
        const missing = required.filter(key => !(globalThis as any).Deno.env.get(key));

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
        }

        return env;
    } catch (error) {
        console.error("Failed to load environment variables:", error);
        throw error;
    }
}
