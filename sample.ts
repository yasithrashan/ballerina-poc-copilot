import { generateText, stepCountIs, tool } from "ai";
import { ANTHROPIC_HAIKU, getAnthropicClinet } from "./connection";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import type { Library } from "./libs/types";
import { LANGLIBS } from "./libs/langlibs";
import path from "path";
import { z } from "zod"

// Token usage tracking interface
interface TokenUsage {
    userQueryTokens: number;
    langLibsTokens: number;
    apiDocsTokens: number;
    balMdTokens: number;
    extractCodeTokens: number;
    totalInputTokens: number;
    outputTokens: number;
}

// Simple token counting function (approximate)
function countTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is a simplified approach; for more accuracy, you'd use a proper tokenizer
    return Math.ceil(text.length / 4);
}

// Get the API DOCS
const jsonPath = process.env.API_DOC_JSON;
if (!jsonPath) {
    throw new Error("Missing environment variable: API_DOC_JSON");
}
const API_DOC = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Library;
const LANG_LIB = LANGLIBS as Library[];

// Load bal.md file
const balMdPath = process.env.BAL_MD_PATH;
if (!balMdPath || !fs.existsSync(balMdPath)) {
    console.error(`[ERROR] bal.md file not found at path: ${balMdPath}`);
    process.exit(1);
}
const balMdContent = fs.readFileSync(balMdPath, "utf8");
if (!balMdContent.length) {
    console.error(`[ERROR] bal.md is empty at path: ${balMdPath}`);
    process.exit(1);
}

const extractRelevantCode = tool({
    name: "extractRelevantCode",
    description: 'Reads a manual extract file (extractcode.md) and returns the actual relevant code for modification. The path is taken from the environment variable EXTRACT_FILE_PATH.',
    inputSchema: z.object({}),
    execute: async () => {
        const extractFilePath = process.env.EXTRACT_FILE_PATH;
        if (!extractFilePath) {
            throw new Error("[ERROR] EXTRACT_FILE_PATH environment variable is not set.");
        }

        if (!fs.existsSync(extractFilePath)) {
            throw new Error(`[ERROR] File not found at path: ${extractFilePath}`);
        }

        const content = fs.readFileSync(extractFilePath, "utf-8");
        if (!content.length) {
            throw new Error(`[ERROR] File is empty at path: ${extractFilePath}`);
        }

        console.log("[SUCCESS] Extracted the relevant code.");

        return { actualCode: content };
    }
});

// Generate Ballerina code function with token tracking
async function generateBallerinaCode(
    userQuery: string,
    API_DOC: Library[]
): Promise<{ response: string; tokenUsage: TokenUsage }> {
    const systemPromptPrefix = getSystemPromptPrefix(API_DOC);
    const systemPromptSuffix = getSystemPromptSuffix(LANG_LIB);
    const systemPrompt = systemPromptPrefix + "\n\n" + systemPromptSuffix + "\n\n" + getSystemPromptBalMd(balMdContent);

    console.log("Generating Code...");

    // Calculate token usage for different components
    const userQueryTokens = countTokens(userQuery);
    const langLibsTokens = countTokens(JSON.stringify(LANG_LIB));
    const apiDocsTokens = countTokens(JSON.stringify(API_DOC));
    const balMdTokens = countTokens(balMdContent);

    // Get extract code content for token counting
    let extractCodeTokens = 0;
    const extractFilePath = process.env.EXTRACT_FILE_PATH;
    if (extractFilePath && fs.existsSync(extractFilePath)) {
        const extractContent = fs.readFileSync(extractFilePath, "utf-8");
        extractCodeTokens = countTokens(extractContent);
    }

    const totalInputTokens = countTokens(systemPrompt) + userQueryTokens;

    const result = await generateText({
        model: anthropic(getAnthropicClinet(ANTHROPIC_HAIKU)),
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery },
        ],
        tools: { extractRelevantCode },
        stopWhen: stepCountIs(25),
        maxOutputTokens: 8192,
    });

    const outputTokens = countTokens(result.text);

    const tokenUsage: TokenUsage = {
        userQueryTokens,
        langLibsTokens,
        apiDocsTokens,
        balMdTokens,
        extractCodeTokens,
        totalInputTokens,
        outputTokens
    };

    return { response: result.text, tokenUsage };
}

// Helper functions (updated to remove tool-related content)
function getSystemPromptBalMd(balMdContent: string): string {
    return `
3. Project Summary (bal.md)
<bal_md>
${balMdContent}
</bal_md>

There is a tool called extractRelevantContent to get the actual code after reading the bal.md file.

Use this project summary to understand the high level details of the project files for writing Ballerina code.
This file includes:
    Each File:
        -imports
        -configurableLevelVariables
        -moduleLevelVariable
        -types
        -functions
        -services
        -resources
        - Comments/ Doc-Comments
Read carefully and understand the overall project summary.
`;
}

function getSystemPromptPrefix(api_docs: Library[]): string {
    return `You are an expert assistant who specializes in writing Ballerina code. Your goal is to ONLY answer Ballerina related queries. You should always answer with accurate and functional Ballerina code that addresses the specified query while adhering to the constraints of the given API documentation.

You will be provided with the following inputs:

1. API_DOCS: A JSON string containing the API documentation for various Ballerina libraries and their functions, types, and clients.
<api_docs>
${JSON.stringify(api_docs)}
</api_docs>
`;
}

function getSystemPromptSuffix(langlibs: Library[]): string {
    return `2. Langlibs
<langlibs>
${JSON.stringify(langlibs)}
</langlibs>

If the query doesn't require code examples, answer the query by utilizing the API documentation.
If the query requires code, follow these steps to generate the Ballerina code:

1. Understand the Goal and High-Level Context
    - First, analyze the user's query and the Project Summary carefully (<bal_md>).
    - Thought: What is the user's primary goal? Am I creating a new feature, modifying existing code, or fixing a bug?
    - Analysis: Use the <bal_md> content to get a high-level summary of the project and identify which parts of the codebase are relevant to the query.
    - Once the bal.md file has been successfully read, return the matched context based on the user query, formatted as specified below in your response.


    Print a JSON object with the following fields exactly in the response:
    {
    "targetFile": "...",
    "imports": [...],
    "configurables": [...],
    "moduleVars": [...],
    "typeDefs": [...],
    "functionDefs": [...],
    "serviceDefs": [...],
    "resourceDefs": [...]
    }

    Rule:   After that, call the tool "extractRelevantCode" to get the actual code.
            Use the "extractFilePath" parameter that is provided by the environment / system (do not try to generate paths yourself).

            You must use the extractRelevantCode tool for get actual content.

2. Carefully analyze the provided API documentation:
   - Identify the available libraries, clients, their functions and their relevant types.

3. Thoroughly read and understand the given query:
   - Identify the main requirements and objectives of the integration.
   - Determine which libraries, functions and their relevant records and types from the API documentation are needed to achieve the query and forget about unused API docs.
   - Note the libraries needed to achieve the query and plan the control flow of the application based on input and output parameters of each function of the connector according to the API documentation.

4. Plan your code structure:
   - Decide which libraries need to be imported (Avoid importing lang.string, lang.boolean, lang.float, lang.decimal, lang.int, lang.map langlibs as they are already imported by default).
   - Determine the necessary client initialization.
   - Define Types needed for the query in the types.bal file.
   - Outline the service OR main function for the query.
   - Outline the required function usages as noted in Step 3.
   - Based on the types of identified functions, plan the data flow. Transform data as necessary.

5. Generate the Ballerina code:
   - Start with the required import statements.
   - Define required configurables for the query. Use only string, int, boolean types in configurable variables.
   - Initialize any necessary clients with the correct configuration at the module level(before any function or service declarations).
   - Implement the main function OR service to address the query requirements.
   - Use defined connectors based on the query by following the API documentation.
   - Use only the functions, types, and clients specified in the API documentation.
   - Use dot notation to access a normal function. Use -> to access a remote function or resource function.
   - Ensure proper error handling and type checking.
   - Do not invoke methods on json access expressions. Always use separate statements.
   - Use langlibs ONLY IF REQUIRED.

6. Review and refine your code:
   - Check that all query requirements are met.
   - Verify that you're only using elements from the provided API documentation.
   - Ensure the code follows Ballerina best practices and conventions.

Provide a brief explanation of how your code addresses the query and then output your generated ballerina code.

Important reminders:
- Only use the libraries, functions, types, services and clients specified in the provided API documentation.
- Always strictly respect the types given in the API Docs.
- Do not introduce any additional libraries or functions not mentioned in the API docs.
- Only use specified fields in records according to the api docs. this applies to array types of that record as well.
- Ensure your code is syntactically correct and follows Ballerina conventions.
- Do not use dynamic listener registrations.
- Do not write code in a way that requires updating/assigning values of function parameters.
- ALWAYS Use two words camel case identifiers (variable, function parameter, resource function parameter and field names).
- If the library name contains a . Always use an alias in the import statement. (import org/package.one as one;)
- Treat generated connectors/clients inside the generated folder as submodules.
- A submodule MUST BE imported before being used.  The import statement should only contain the package name and submodule name.  For package my_pkg, folder structure generated/fooApi the import should be import my_pkg.fooApi;
- If the return parameter typedesc default value is marked as <> in the given API docs, define a custom record in the code that represents the data structure based on the use case and assign to it.
- Whenever you have a Json variable, NEVER access or manipulate Json variables. ALWAYS define a record and convert the Json to that record and use it.
- When invoking resource function from a client, use the correct paths with accessor and parameters. (eg: exampleClient->/path1/["param"]/path2.get(key="value"))
- When you are accessing a field of a record, always assign it into new variable and use that variable in the next statement.
- Avoid long comments in the code. Use // for single line comments.
- Always use named arguments when providing values to any parameter. (eg: .get(key="value"))
- Mention types EXPLICITLY in variable declarations and foreach statements.
- Do not modify the README.md file unless asked to be modified explicitly in the query.
- Do not add/modify toml files(Config.toml/Ballerina.toml) unless asked.
- In the library API documentation if the service type is specified as generic, adhere to the instructions specified there on writing the service.
- For GraphQL service related queries, If the user haven't specified their own GraphQL Schema, Write the proposed GraphQL schema for the user query right after explanation before generating the ballerina code. Use same names as the GraphQL Schema when defining record types.

Begin your response with the explanation, once the entire explanation is finished only, include codeblock segments(if any) in the end of the response.
Do not forget to write the bal.md matched context according to the user query with the given json format in the end of the response.

Each file which needs modifications, should have a codeblock segment and it MUST have complete file content with the proposed change.


Example Codeblock segment:
<code filename="main.bal">
\`\`\`ballerina
//code goes here
\`\`\`
</code>
`;
}

// Format token usage for output
function formatTokenUsage(tokenUsage: TokenUsage): string {
    return `
=== TOKEN USAGE BREAKDOWN ===
User Query Tokens: ${tokenUsage.userQueryTokens.toLocaleString()}
LangLibs Tokens: ${tokenUsage.langLibsTokens.toLocaleString()}
API Docs Tokens: ${tokenUsage.apiDocsTokens.toLocaleString()}
Bal.md Tokens: ${tokenUsage.balMdTokens.toLocaleString()}
Extract Code MD File Tokens: ${tokenUsage.extractCodeTokens.toLocaleString()}

Total Input Tokens: ${tokenUsage.totalInputTokens.toLocaleString()}
Output Tokens: ${tokenUsage.outputTokens.toLocaleString()}

Total Tokens Used: ${(tokenUsage.totalInputTokens + tokenUsage.outputTokens).toLocaleString()}
`;
}

// Main execution
async function main() {
    try {
        const userQuery = process.env.USER_QUERY;
        if (!userQuery || !userQuery.trim()) {
            console.error("[ERROR] USER_QUERY environment variable is not set or empty.");
            process.exit(1);
        }

        console.log("Starting Ballerina code generation with token tracking...");

        // Run the code generator with token tracking
        const { response, tokenUsage } = await generateBallerinaCode(userQuery, [API_DOC]);

        // Log token usage to console
        console.log("\n" + formatTokenUsage(tokenUsage));

        // Ensure output directory
        const outputDir = path.join(process.cwd(), "poc");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Timestamp for filename
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const outputPath = path.join(outputDir, `${timestamp}.txt`);

        // Final content with response and token usage
        const finalContent = `=== USER QUERY ===
${userQuery}

=== RESPONSE ===
${response}

${formatTokenUsage(tokenUsage)}

=== GENERATION METADATA ===
Generated At: ${now.toISOString()}
Model Used: ${ANTHROPIC_HAIKU}
Max Output Tokens: 8192
Step Count Limit: 25
`;

        // Save everything into one txt file
        fs.writeFileSync(outputPath, finalContent, "utf-8");
        console.log(`\nMain execution output saved to ${outputPath}\n`);

        // Also create a separate JSON file with just the token usage for easy parsing
        const tokenUsageJsonPath = path.join(outputDir, `${timestamp}_tokens.json`);
        fs.writeFileSync(tokenUsageJsonPath, JSON.stringify({
            timestamp: now.toISOString(),
            userQuery,
            tokenUsage,
            model: ANTHROPIC_HAIKU,
            maxOutputTokens: 8192,
            stepCountLimit: 25
        }, null, 2), "utf-8");

        console.log(`Token usage JSON saved to ${tokenUsageJsonPath}\n`);

    } catch (error) {
        console.error("Error generating Ballerina code:", error);
        process.exit(1);
    }
}

main();