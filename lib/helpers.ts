// lib/helpers.ts

// lib/helpers.ts
// lib/helpers.ts
import { Config } from './config.ts';
import ky from 'npm:ky';
import { Api, RawApi, Message, PhotoSize, Sticker } from 'npm:grammy'; // Combined grammy imports
import { Logger } from 'jsr:@deno-library/logger@^1.1.9'; // Or specific version
import { ImagePart, supportedTypesMap } from './history.ts';
import { exists } from '@std/fs/exists';
// REMOVED: import { Message, PhotoSize, Sticker } from 'npm:grammy-types';
import { FileState, GoogleAIFileManager } from 'npm:@google/generative-ai/server';
import { CoreMessage } from 'npm:ai'; // Ensure 'ai' is the correct package (e.g., Vercel AI SDK)
import { BotCharacter } from './memory.ts';
// import { encodeBase64 } from "@std/encoding/base64";

// ... rest of your helpers.ts code
// import { encodeBase64 } from "@std/encoding/base64"; // If using, use @std/

// ... rest of your helpers.ts code
// If you were using base64:
// import { encodeBase64 } from "@std/encoding/base64";
// import { encodeBase64 } from "https://deno.land/std@0.220.0/encoding/base64.ts";

// ... rest of your code
// If you were using this, it would also need a full URL:
// import { encodeBase64 } from "https://deno.land/std@0.220.0/encoding/base64.ts";

// ... rest of your code
// import { encodeBase64 } from "@std/encoding/base64";

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export function stickerToText({ emoji }: Sticker): string {
    return emoji ? `[Sticker ${emoji}]` : '[Sticker]';
}

export function sliceMessage(message: string, maxLength: number): string {
    return message.length > maxLength
        ? message.slice(0, maxLength) + '...'
        : message;
}

export function splitMessage(message: string, maxLength = 3000) {
    if (maxLength <= 0) {
        throw new Error('Max length must be positive');
    }

    const parts: string[] = [];
    let currentIndex = 0;

    while (currentIndex < message.length) {
        let endIndex = Math.min(currentIndex + maxLength, message.length);

        // If we're not at the end of the message
        if (endIndex < message.length) {
            // First try to break at a newline for more natural splits
            const lastNewline = message.lastIndexOf('\n', endIndex);

            if (lastNewline > currentIndex) {
                endIndex = lastNewline;
            } else {
                // If no newline found, look for the last space
                const lastSpace = message.lastIndexOf(' ', endIndex);
                if (lastSpace > currentIndex) {
                    endIndex = lastSpace;
                }
                // If no space found, we'll force break at maxLength (default behavior)
            }
        }

        // Extract the part and trim whitespace
        const part = message.slice(currentIndex, endIndex).trim();

        // Only add non-empty parts
        if (part) {
            parts.push(part);
        }

        // Move to next chunk
        currentIndex = endIndex;
        if (
            currentIndex < message.length &&
            (message[currentIndex] === ' ' || message[currentIndex] === '\n')
        ) {
            currentIndex++;
        }
    }

    return parts;
}

const AI_TOKEN = Deno.env.get('AI_TOKEN');

if (!AI_TOKEN) {
    throw new Error('AI_TOKEN is required');
}

const fileManager = new GoogleAIFileManager(AI_TOKEN);

async function uploadToGoogle(path: string, name: string, mimeType: string) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: name,
    });

    let file = await fileManager.getFile(uploadResult.file.name);
    while (file.state === FileState.PROCESSING) {
        // deno-lint-ignore no-explicit-any
        await new Promise((resolve: any) => setTimeout(resolve, 1000)); // Increased timeout slightly
        file = await fileManager.getFile(uploadResult.file.name);
    }

    if (file.state === FileState.FAILED) {
        throw new Error('Google AI File processing failed.');
    }

    return file.uri;
}

export async function downloadFile(
    api: Api<RawApi>,
    token: string,
    fileId: string,
    mimeType: string,
) {
    const filePath = `./tmp/${fileId}`;
    // Ensure tmp directory exists
    try {
        await Deno.mkdir("./tmp", { recursive: true });
    } catch (e) {
        if (!(e instanceof Deno.errors.AlreadyExists)) {
            throw e;
        }
    }

    if (await exists(filePath)) {
        // return encodeBase64(await Deno.readFile(filePath))
        return uploadToGoogle(filePath, fileId, mimeType);
    }

    const file = await api.getFile(fileId);

    if (!file.file_path) {
        throw new Error(`File path not found for file ID: ${fileId}`);
    }

    const downloadUrl =
        `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await ky.get(downloadUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await Deno.writeFile(filePath, buffer);

    // return encodeBase64(buffer);
    return uploadToGoogle(filePath, fileId, mimeType);
}

export async function getImageContent(
    api: Api<RawApi>,
    token: string,
    fileId: string,
    mimeType: string,
): Promise<ImagePart> {
    const fileUri = await downloadFile(api, token, fileId, mimeType);

    return {
        type: 'image',
        image: fileUri, // This should be the URI from Google, not the file path
        mimeType,
    };
}

export function chooseSize(photos: PhotoSize[]): PhotoSize {
    // Filter out photos without file_size before sorting
    const sizedPhotos = photos.filter(p => p.file_size !== undefined && p.file_size !== null);

    if (sizedPhotos.length === 0) {
        // Fallback if no photos have file_size, return the first one or handle error
        if (photos.length > 0) return photos[0];
        throw new Error("No photos provided or none have file_size");
    }

    return sizedPhotos.sort((a, b) => {
        // At this point, a.file_size and b.file_size are guaranteed to be numbers
        return (b.file_size as number) - (a.file_size as number);
    })[0];
}

/**
 * Deletes old files from tmp folder
 * @param logger Logger
 * @param maxAge Max age in hours
 */
export async function deleteOldFiles(logger: Logger, maxAge: number) {
    const tmpDir = './tmp';
    // Ensure tmp directory exists before trying to read it
    try {
        await Deno.stat(tmpDir);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            logger.info(`Directory ${tmpDir} does not exist, nothing to delete.`);
            return;
        }
        throw error; // Re-throw other errors
    }

    const files = Deno.readDir(tmpDir);

    let deletedCount = 0;
    for await (const file of files) {
        if (file.isDirectory) continue; // Skip directories

        const filePath = `${tmpDir}/${file.name}`;

        try {
            const stat = await Deno.stat(filePath);
            const mtime = stat.mtime?.getTime() ?? 0;
            const age = (Date.now() - mtime) / (1000 * 60 * 60);

            if (age > maxAge || stat.mtime === null) {
                await Deno.remove(filePath);
                deletedCount++;
            }
        } catch (error) {
             // Log if stat or remove fails, but continue
            logger.warn(`Failed to process or delete file: ${filePath}`, error);
        }
    }

    if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} old files from ${tmpDir}`);
    } else {
        logger.info(`No old files to delete from ${tmpDir}`);
    }
}

export function getRandomNepon(config: Config) {
    const nepons = config.nepons;
    if (!nepons || nepons.length === 0) {
        // Handle case where nepons might be undefined or empty
        throw new Error("Nepons configuration is empty or missing.");
    }
    const randomIndex = getRandomInt(0, nepons.length); // max is exclusive, so nepons.length is fine
    return nepons[randomIndex];
}

/**
 * Returns true with probability of `percentage`
 * @param percentage
 * @returns boolean
 * @throws Error if `percentage` is not between 0 and 100
 */
export function probability(percentage: number) {
    if (percentage < 0 || percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
    }

    return Math.random() < percentage / 100;
}

export function testMessage(regexs: Array<string | RegExp>, text: string) {
    if (!text) return false; // Handle undefined or null text
    return regexs.some((regex) => {
        if (typeof regex === 'string') {
            return text.includes(regex);
        }
        return regex.test(text);
    });
}

export function msgTypeSupported(msg: Message) {
    for (const [type] of supportedTypesMap) {
        if (type in msg && msg[type as keyof Message] !== undefined) {
            return true;
        }
    }
    return false;
}

/**
 * Recursively removes object fields with key names ending with specified suffixes
 * @param obj - The object to process
 * @param suffixes - Array of suffixes to match against key names
 * @returns A new object with matching fields removed
 */
export function removeFieldsWithSuffixes<T>(
    obj: T,
    suffixes: string[] = ['id', 'size', 'thumbnail', 'date'],
    // deno-lint-ignore no-explicit-any
): any {
    // Handle null or undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item) => removeFieldsWithSuffixes(item, suffixes));
    }

    // Handle objects
    // deno-lint-ignore no-explicit-any
    const result: Record<string, any> = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Skip keys ending with any of the specified suffixes
            if (suffixes.some((suffix) => key.endsWith(suffix))) {
                continue;
            }
            // Recursively process nested objects
            result[key] = removeFieldsWithSuffixes(obj[key], suffixes);
        }
    }
    return result;
}

// Helper function to escape special regex characters
function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function prettyDate() {
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Moscow', // Consider making timezone configurable
    };

    const now = new Date();
    // Use 'ru' for Russian locale for consistency with timezone if desired
    const formattedDate = now.toLocaleDateString('ru-RU', options);
    return formattedDate;
}

// Create a more robust name matching function
export function createNameMatcher(names: string[]) {
    // Process each name to handle special characters and create proper boundaries
    const patterns = names.map((name) => {
        if (name.trim() === '') return ''; // Avoid empty patterns
        const escapedName = escapeRegExp(name);
        // Match names that are surrounded by non-word characters or at start/end of text
        // Using \b might be too restrictive if names can be part of other words or have special chars.
        // This pattern is more explicit about boundaries.
        return `(?:^|[^a-zA-Z0-9а-яА-ЯЁё])${escapedName}(?:[^a-zA-Z0-9а-яА-ЯЁё]|$)`;
    }).filter(pattern => pattern !== ''); // Filter out empty patterns

    if (patterns.length === 0) {
        // Return a regex that never matches if no valid names are provided
        return new RegExp('$^'); // Matches nothing
    }

    return new RegExp(patterns.join('|'), 'gmi');
}

export function formatReply(
    m: CoreMessage | { text: string; reply_to?: string }[],
    char?: BotCharacter,
) {
    const charName = char?.name ?? 'Slusha';
    let text = '';

    let content;
    let role: string | undefined;

    if (!Array.isArray(m) && 'role' in m) {
        role = m.role;
        content = m.content;
    } else {
        // This case handles the { text: string; reply_to?: string }[] array
        // or a CoreMessage without a role (though CoreMessage should have a role)
        content = m;
    }

    if (role === 'assistant' || Array.isArray(content)) { // Assuming array content implies assistant output
        text += `${charName}:`;
    }

    if (typeof content === 'string') {
        text += ('\n    ' + content.trim().replace(/\n/g, '\n    '));
    } else if (Array.isArray(content)) {
        text += content.map((c) => {
            let res = '';
            // Check if 'c' is a part of CoreMessage content (e.g., TextPart, ImagePart)
            // or the custom { text: string; reply_to?: string } structure
            if ('text' in c && typeof c.text === 'string') { // Handles { text: string; ... }
                res = (role === 'assistant' ? '\n' : '') + `    ${c.text}`;
            } else if ('type' in c) { // Handles parts of CoreMessage.content if it's an array
                switch (c.type) {
                    case 'text':
                        res = (role === 'assistant' ? '\n' : '') + c.text;
                        break;
                    case 'image': // Assuming ImagePart has 'image' and 'mimeType'
                        res = `    image: ${'image' in c ? c.image : '[Missing image data]'} (${'mimeType' in c ? c.mimeType : '[Missing mimeType]'})`;
                        break;
                    case 'file': // Assuming FilePart has 'data' and 'mimeType'
                        res = `    file: ${'data' in c ? c.data : '[Missing file data]'} (${'mimeType' in c ? c.mimeType : '[Missing mimeType]'})`;
                        break;
                    default:
                        // Potentially stringify unknown parts if necessary
                        res = `    [Unsupported content part: ${JSON.stringify(c)}]`;
                }
            } else {
                 res = `    [Unknown content structure: ${JSON.stringify(c)}]`;
            }
            return res.replace(/\n/g, '\n    ');
        }).join(''); // Removed join('\n') as each part already prepends spaces/newlines
    }


    return text;
}