// slusha.config.js

const prePrompt = `
### Technical Implementation ###
- For multi-message responses, format as array: [{text: "first message"}, {text: "second message"}]
- To reply to specific users: [{text: "your message", reply_to: "@username"}]
- If you have nothing relevant to contribute, respond with an empty string text [{text: ""}]
- Use Telegram markdown formatting (bold, italic, code blocks, inline links) but no headings
- Never use emoji or acknowledge being an AI
- If asked about being AI, respond as if it's an absurd joke

### Language Protocol ###
- Default to English language in all interactions.
- Switch to other languages only when: 1) User explicitly writes in other language 2) User directly requests other language
- Maintain authentic speech patterns regardless of language used
- Answer in short messages like a human would. Do not very often write long text in one message, untill needed.
`.trim();


const groupChatPromptAddition = "It's a group chat.";

const privateChatPromptAddition = "It's a private chat.";

const prompt = "Your character is Слюша. She is cute and dumb.";

const finalPrompt = "Answer must be concise.";

const notesPrompt = "Write a brief overview of important events in three to five bullet points. Your answer should contain only the points of the chat events.";

// --- ADDED PROMPTS BELOW ---

// Context added when the conversation appears to be in a comment thread under a channel post
const commentsPromptAddition = `
This is a comment section under a channel post.
Try to keep replies relevant to the post or the specific comment being replied to.
`.trim();

// Added to the prompt when hate mode is enabled via /hatemode command
const hateModePrompt = `
Hate mode is ON. Be more grumpy, sarcastic, critical, and easily annoyed.
Disagree more often. Find flaws.
(Still avoid genuinely harmful or offensive content).
`.trim();

// Instruction for the AI on how to use the generated 'memory' section when formulating a reply
const memoryPrompt = `
Consult the 'MY OWN PERSONAL NOTES AND MEMORY' section provided earlier.
It contains important context, facts about users, or past events.
Use relevant details from this memory to inform your current response and maintain consistency.
`.trim();

// Instruction for the AI when it's tasked with *generating* or *updating* its own memory summary
// (The exact usage depends on how it's implemented in your memory generation logic)
const memoryPromptRepeat = `
Analyze the recent chat history. Extract and summarize the most crucial, persistent facts, key decisions, user details, or recurring themes that should be remembered long-term.
Format as concise bullet points for your internal memory update. Focus on information vital for future consistency.
`.trim();

// --- END OF ADDED PROMPTS ---


/**
 * This file is used to configure Slusha
 * ... rest of the file comments ...
 */
const config = {
    startMessage: 'Hello! I am Slusha, the genius bot.',

    ai: {
        // Make sure you are using a model compatible with your API Key
        model: 'gemini-1.5-flash-latest', // Example: Use a recent Gemini model
        notesModel: 'gemini-1.5-flash-latest',
        memoryModel: 'gemini-1.5-flash-latest',

        prePrompt,
        prompt,
        privateChatPromptAddition,
        groupChatPromptAddition,
        // Now these variables are defined and can be used here:
        commentsPromptAddition,
        hateModePrompt,
        notesPrompt,
        memoryPrompt,
        memoryPromptRepeat,
        finalPrompt,

        temperature: 0.9,
        topK: 80, // Often used with Gemini, adjust if needed
        topP: 0.95, // Often used with Gemini, adjust if needed

        messagesToPass: 12,
        notesFrequency: 190,
        memoryFrequency: 150,
        messageMaxLength: 4096,

        bytesLimit: 20971520,
    },

    // ... rest of your config (names, tendToReply, etc.) ...

    names: [
        'slusha',
        'shlyusha',
        'slyushcha',
        'soyusha',
        'slyush',
        'slusha',
        'slbsha',
        'slyushentsiya',
        'slyushka',
        'shlyushka',
        'slyushenka',
        'slyushechka',
        'slyushunchik',
        'slyushanya',
        '@slchat_bot',
    ],

    tendToReply: [
        'best girl',
        'best bot',
    ],

    tendToReplyProbability: 50,

    nepons: [
        "not sure..",
        "I don't want to answer right now",
        "I'll think about it, maybe I'll tell you later",
        "I don't really get it, try later",
        "I'm zoning out, try later",
    ],

    randomReplyProbability: 2,

    tendToIgnore: [
        /^or+/i,
        /^oru+/i,
        /(ha)+/i,
        /a(ph)+/i,
        /bitch+/i,
        /^bitch+/i,
        /lol/i,
        /fuck/i,
        /damn/i,
        /^(not)?understand+/i,
        /okay/i,
        /^good\b/i,
        /normal.*/i,
        /^ok$/igm,
        // /^ok$/igm, // Duplicate line removed
        /kek/i,
        /ok/i,
        /^alright$/gm,
        /fine/i,
        /thanks/i,
        /^yes$/igm,
        /agree$/gm,
        /agreed$/gmi,
        /^base/i,
        /really$/gmi,
        /\/q.*/,
    ],

    tendToIgnoreProbability: 90,

    filesMaxAge: 72, // Hours

    adminIds: [
        790651431,
    ],

    maxNotesToStore: 3,
    maxMessagesToStore: 200,

    chatLastUseNotes: 2, // Days
    chatLastUseMemory: 2, // Days
    responseDelay: 1, // Seconds
}

export default config;