import { generateText, stepCountIs, tool } from "ai";
import { ANTHROPIC_HAIKU, getAnthropicClinet } from "./connection";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import type { Library } from "./libs/types";
import { LANGLIBS } from "./libs/langlibs";
import path from "path";
import { z } from "zod";

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

const projectPath = process.env.PROJECT_PATH;
if (!projectPath) {
    console.error("[ERROR] PROJECT_PATH environment variable is not set.");
    process.exit(1);
}

// LLM-based content extraction function
async function extractRelevantContentWithLLM(
    fileContent: string,
    fileName: string,
    symbols: string[]
): Promise<string | undefined> {
    const systemPrompt = `You are a Ballerina code analyzer. Your task is to extract the relevent context from Ballerina source files.

CRITICAL INSTRUCTIONS:
1. Extract ONLY the exact relevent code - be very precise
2. If the relevent code not include try to get similar or related code but related to given symbols
3. Only return complete, syntactically correct code segments for the requested symbols
4. Include necessary imports only if they are directly used by the extracted symbols

Return the extracted content in this format:
### File: ${fileName}

[Only if there are relevant imports for the extracted symbols]
#### Imports
\`\`\`ballerina
[only imports used by extracted symbols]
\`\`\`

[Only for each requested symbol that exists in the file]
#### [Symbol Type]: [exact symbol name]
\`\`\`ballerina
[complete symbol definition]
\`\`\`

IMPORTANT:
- If no requested symbols are found, return "No matching symbols found in this file"
- Be very strict about matching - only extract what was specifically requested
- Do not add extra functions, types, or code that wasn't asked for`;

    const userQuery = symbols.length > 0
        ? `Extract ONLY these specific symbols from the Ballerina code: ${symbols.join(', ')}\n\nBe very precise - only extract the exact symbols requested, nothing else.\n\nFile: ${fileName}\n\nCode:\n${fileContent}`
        : `Extract all major code elements from this Ballerina file.\n\nFile: ${fileName}\n\nCode:\n${fileContent}`;

    try {
        const { text } = await generateText({
            model: anthropic(getAnthropicClinet(ANTHROPIC_HAIKU)),
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery },
            ],
            maxOutputTokens: 4096,
        });

        return text;
    } catch (error) {
        console.error(`[ERROR] LLM extraction failed for ${fileName}:`, error);
    }
}

export const tools = {
    extractRelevantContentWithLLM: tool({
        description:
            "Reads all Ballerina source files in the project and uses the LLM to extract only relevant symbols. Saves result to code-extract folder.",
        inputSchema: z.object({
            symbols: z
                .array(z.string())
                .describe(
                    "List of symbols/keywords and contexts or identifiers to search for relevent contexts."
                ),
        }),
        execute: async ({ symbols }) => {
            try {
                console.log(`[DEBUG] Tool called with symbols: ${JSON.stringify(symbols)}`);
                console.log(`[DEBUG] PROJECT_PATH: ${projectPath}`);

                // Verify project path exists
                if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
                    const error = `Invalid PROJECT_PATH: ${projectPath}`;
                    console.error(`[ERROR] ${error}`);
                    return error;
                }

                // Collect all .bal files
                let files: string[] = [];
                try {
                    files = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
                } catch (err) {
                    const errorMsg = `Failed to read project directory: ${err}`;
                    console.error(`[ERROR] ${errorMsg}`);
                    return errorMsg;
                }

                if (files.length === 0) {
                    return `No .bal files found in project: ${projectPath}`;
                }

                let mdResult = "";
                let processedFiles = 0;

                for (const file of files) {
                    const fullPath = path.join(projectPath, file);
                    console.log(`[DEBUG] Processing file: ${fullPath}`);

                    if (!fs.existsSync(fullPath)) {
                        console.warn(`[WARN] File not found: ${fullPath}`);
                        continue;
                    }

                    const content = fs.readFileSync(fullPath, "utf-8");
                    if (!content.trim()) {
                        console.log(`[INFO] File ${file} is empty, skipping`);
                        continue;
                    }

                    // ⚠️ No keyword filtering — always send to LLM
                    processedFiles++;
                    const fileMd = await extractRelevantContentWithLLM(content, file, symbols);
                    if (fileMd) {
                        mdResult += fileMd + "\n\n";
                    }
                }

                console.log(`[DEBUG] Processed ${processedFiles} files`);

                if (!mdResult.trim()) {
                    const message = `No matching symbols found by LLM in ${files.length} files. Symbols searched: ${symbols.join(", ") || "all"}`;
                    const emptyResultMd = `# Code Extract Report - No Results\n\n${message}`;
                    const savedFilePath = saveMarkdownToFile(emptyResultMd, symbols);
                    return `${message}\n\nReport saved to: ${savedFilePath}`;
                }

                // Save result
                const finalMd = `# Code Extract Report\n\n**Symbols searched:** ${symbols.join(", ") || "all symbols"
                    }\n**Files processed:** ${processedFiles}\n**Generated:** ${new Date().toISOString()}\n\n---\n\n${mdResult}`;

                const savedFilePath = saveMarkdownToFile(finalMd, symbols);
                return `${mdResult}\n\n---\n**Report saved to:** \`${savedFilePath}\``;
            } catch (error) {
                const errMsg = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
                console.error(`[ERROR] ${errMsg}`);
                return errMsg;
            }
        },
    }),
};


// Generate Ballerina code function (unchanged)
async function generateBallerinaCode(
    userQuery: string,
    API_DOC: Library[]
): Promise<{ text: string; tokenSummary: any }> {
    const systemPromptPrefix = getSystemPromptPrefix(API_DOC);
    const systemPromptSuffix = getSystemPromptSuffix(LANG_LIB);
    const systemPrompt = systemPromptPrefix + "\n\n" + systemPromptSuffix + "\n\n" + getSystemPromptBalMd(balMdContent);

    console.log("Generating Code Agentic...");

    const { text, usage } = await generateText({
        model: anthropic(getAnthropicClinet(ANTHROPIC_HAIKU)),
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery },
        ],
        tools: tools,
        stopWhen: stepCountIs(25),
        maxOutputTokens: 8192,
    });

    // Only keep relevant token info
    const tokenSummary = {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        totalTokens:
            (usage?.inputTokens ?? 0) +
            (usage?.outputTokens ?? 0),
    };

    return { text, tokenSummary };
}


// Helper functions (unchanged)
function getSystemPromptBalMd(balMdContent: string): string {
    return `
3. Project Summary (bal.md)
<bal_md>
${balMdContent}
</bal_md>

Use this project summary to understand project-specific guidelines, architecture, and best practices for writing Ballerina code.
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

2. Extract Exact Code Context with the extractRelevantContentWithLLM tool
    - Thought: Based on my goal, do I need to see the exact source code of a symbols/keywords mentioned in the query or <bal_md>?
    - Thought: To provide accurate results for modifications or bug fixes, I must see the actual implementation using extractRelevantContentWithLLM.
    - Thought: If I don't have the actual implementation for relevant code, I have a higher chance of missing details or giving incorrect guidance.
    - Rule: Do not guess the code. If the query involves modifying existing code, always call the tool to get the actual code.
    - Action: Call the extractRelevantContentWithLLM tool with a list of relevant symbols/keywords and related context. The tool will search the project directory for .bal files, extract relevant code segments using LLM analysis, and return structured markdown.
    - Exception: If the user query is about generating something from scratch (new feature, documentation, or conceptual explanation), you can ignore the tool.

3. Carefully analyze the provided API documentation:
   - Identify the available libraries, clients, their functions and their relevant types.

4. Thoroughly read and understand the given query:
   - Identify the main requirements and objectives of the integration.
   - Determine which libraries, functions and their relevant records and types from the API documentation are needed to achieve the query and forget about unused API docs.
   - Note the libraries needed to achieve the query and plan the control flow of the application based on input and output parameters of each function of the connector according to the API documentation.

5. Plan your code structure:
   - Decide which libraries need to be imported (Avoid importing lang.string, lang.boolean, lang.float, lang.decimal, lang.int, lang.map langlibs as they are already imported by default).
   - Determine the necessary client initialization.
   - Define Types needed for the query in the types.bal file.
   - Outline the service OR main function for the query.
   - Outline the required function usages as noted in Step 4.
   - Based on the types of identified functions, plan the data flow. Transform data as necessary.

6. Generate the Ballerina code:
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

7. Review and refine your code:
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
Also can you mention why you call or not call the tool
If you feel like the given api docs are not enough for complete user user task, add this also.
Its better to print the feedback in the below of your response also include why you use , not use the tool
The explanation should explain the control flow along with the selected libraries and their functions.

Each file which needs modifications, should have a codeblock segment and it MUST have complete file content with the proposed change.

Example Codeblock segment:
<code filename="main.bal">
\`\`\`ballerina
//code goes here
\`\`\`
</code>
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

        // Run the code generator
        const { text: response, tokenSummary } = await generateBallerinaCode(userQuery, [API_DOC]);

        // Ensure output directory
        const outputDir = path.join(process.cwd(), "poc");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Timestamp for filename
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const outputPath = path.join(outputDir, `${timestamp}.txt`);

        // Final content with response + token usage
        const finalContent = `=== USER QUERY ===
${userQuery}

=== RESPONSE ===
${response}

=== TOKEN USAGE ===
Input Tokens: ${tokenSummary.inputTokens}
Output Tokens: ${tokenSummary.outputTokens}
Tool Call Tokens: ${tokenSummary.toolCallTokens}
Total Counted Tokens: ${tokenSummary.totalTokens}
`;

        // Save everything into one txt file
        fs.writeFileSync(outputPath, finalContent, "utf-8");
        console.log(`\nMain execution output (including token usage) saved to ${outputPath}\n`);
    } catch (error) {
        console.error("Error generating Ballerina code:", error);
    }
}


main();

export { generateBallerinaCode };

function saveMarkdownToFile(mdResult: string, symbols: string[]): string {
    const outputDir = path.join(process.cwd(), "code-extract");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const symbolsPart = symbols.length > 0 ? symbols.join("_") : "all";
    const filename = `code_extract_${symbolsPart}_${timestamp}.md`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, mdResult, "utf-8");
    return filePath;
}