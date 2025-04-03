/**
 * Module for loading environment variables from .env file
 */

/**
 * Loads environment variables from .env file
 */
export async function loadEnvFromFile(): Promise<void> {
    try {
        console.log('Loading environment variables from .env file...');
        const text = await Deno.readTextFile('.env');
        const lines = text.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                // Remove quotes if present
                let value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length - 1);
                }
                
                Deno.env.set(key, value);
                console.log(`Set environment variable: ${key}`);
            }
        }
        console.log('Environment variables loaded successfully');
    } catch (error) {
        console.error('Error loading .env file:', error);
    }
}

// Load environment variables immediately
await loadEnvFromFile(); 