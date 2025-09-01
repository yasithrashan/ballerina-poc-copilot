import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import { z } from "zod";

// Load project path
const projectPath = process.env.PROJECT_PATH;
if (!projectPath || !fs.existsSync(projectPath)) {
    console.error("[ERROR] PROJECT_PATH environment variable is not set or invalid.");
    process.exit(1);
}

// Load user query
const userQuery = process.env.USER_QUERY;
if (!userQuery || !userQuery.trim()) {
    console.error("[ERROR] USER_QUERY environment variable is not set or empty.");
    process.exit(1);
}

// Load bal.md
const balMdPath = process.env.BAL_MD_PATH;
if (!balMdPath || !fs.existsSync(balMdPath)) {
    console.error("[ERROR] bal.md file not found at path:", balMdPath);
    process.exit(1);
}
const balMdContent = fs.readFileSync(balMdPath, "utf-8");

// Tool definition
const extractRelevantContentTool = tool({
    description: "Extracts relevant content from .bal files and formats as structured markdown report.",
    inputSchema: z.object({
        extractedContent: z.string().describe("The main extracted content from .bal files"),
        searchCriteria: z.string().describe("Summary of what was searched for"),
    }),
    execute: async (result) => {
        // Get file count
        const balFiles = fs.readdirSync(projectPath as string).filter(f => f.endsWith(".bal"));
        const fileCount = balFiles.length;

        // Create markdown report
        const timestamp = new Date().toISOString();
        const reportContent = `# Code Extract Report

**Search criteria:** ${result.searchCriteria}
**Files processed:** ${fileCount}
**Generated:** ${timestamp}

---

${result.extractedContent}`;

        // Save result as md file
        const outputDir = path.join(process.cwd(), "code-extract");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const timestampForFile = timestamp.replace(/[:.]/g, "-");
        const outputPath = path.join(outputDir, `extract_${timestampForFile}.md`);
        fs.writeFileSync(outputPath, reportContent, "utf-8");

        return `Extraction completed. Output saved to: ${outputPath}`;
    },
});

// Main execution
async function main() {
    // Get all .bal files
    const balFiles = fs.readdirSync(projectPath as string).filter(f => f.endsWith(".bal"));

    if (balFiles.length === 0) {
        console.error("[ERROR] No .bal files found in project path.");
        return;
    }

    // Read all .bal file contents
    let allBalContent = "";
    for (const file of balFiles) {
        const fullPath = path.join(projectPath!, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        allBalContent += `### File: ${file}\n\n${content}\n\n`;
    }

    // Single LLM call to extract relevant content
    const systemPrompt = `
    You are a Ballerina Code Analyzer.
    Your task is to process the provided bal.md documentation and the user’s query, then extract the most relevant code segments from the .bal files.

    Instructions:

    - Carefully read the user query.
    - Check the bal.md documentation to understand which files and symbols are related.
    - Extract only the directly relevant code segments (e.g., types, functions, services, resources) that are connected to the query.
    - Rule: Only Include Filename and the code segment only.
    - If there is no existing code that matches, return a clear statement such as:
        "No relevant code segments found for this query."
    - If there is related code (even if not an exact match), provide it for context.
    - Present the extracted content in a clear, organized format, grouped by file.
    - Only provide the original code. Do not suggest replacements or modifications.

bal.md Documentation:
${balMdContent}
`;

    const userPrompt = `
User Query: ${userQuery}

Ballerina Files Content:
${allBalContent}

Please extract the relevant code segments that relate to the user query.
`;

    try {
        const { text, toolResults } = await generateText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            tools: { extractRelevantContentTool },
            toolChoice: "required",
            maxOutputTokens: 4096,
        });

        console.log("Extraction process completed successfully.");

    } catch (err) {
        console.error("[ERROR] Failed to extract content:", err);
    }
}

main();