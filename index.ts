import { generateText, stepCountIs, tool } from "ai";
import {
    ANTHROPIC_HAIKU,
    getAnthropicClinet,
} from "./connection";
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

// Get the LANG_LIBS
const API_DOC = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Library;
const LANG_LIB = LANGLIBS as Library[];

// Load bal.md file from environment variable
const balMdPath = process.env.BAL_MD_PATH;
if (!balMdPath) {
    console.error(
        "[ERROR] BAL_MD_PATH environment variable is not set. Please set it in your .env file or environment."
    );
    process.exit(1);
}

if (!fs.existsSync(balMdPath)) {
    console.error(`[ERROR] bal.md file not found at path: ${balMdPath}`);
    console.error("Please ensure the file exists and the path is correct.");
    process.exit(1);
}

const balMdContent = fs.readFileSync(balMdPath, "utf8");
if (!balMdContent.length) {
    console.error(`[ERROR] bal.md is empty at path: ${balMdPath}`);
    process.exit(1);
}

async function generateBallerinaCode(
    userQuery: string,
    API_DOC: Library[]
): Promise<{ text: string; usage?: any }> {
    // Build complete system prompt
    const systemPromptPrefix = getSystemPromptPrefix(API_DOC);
    const systemPromptSuffix = getSystemPromptSuffix(LANG_LIB);
    const systemPrompt = systemPromptPrefix + "\n\n" + systemPromptSuffix + "\n\n" + getSystemPromptBalMd(balMdContent);

    console.log("=== Generating Ballerina Code ===");

    const { text, usage } = await generateText({
        model: anthropic(getAnthropicClinet(ANTHROPIC_HAIKU)),
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: userQuery,
            },
        ],
        tools: { getASTContext },
        stopWhen: stepCountIs(25),
        maxOutputTokens: 8192,
    });

    return { text, usage };
}

export const getASTContext = tool({
    name: "getASTContext",
    description:
        "Fetches a complete contextual slice of the AST for given symbols, including their definitions, dependencies, reverse dependencies, related endpoints, entities, and metadata.",
    inputSchema: z.object({
        symbols: z
            .array(z.string())
            .describe(
                "An array of Ballerina symbols (functions, types, variables, resources, etc.) OR file names to fetch from the AST."
            ),
    }),
    execute: async ({ symbols }) => {
        const astPath = process.env.AST_JSON_PATH;
        if (!astPath) {
            return { error: "AST_JSON_PATH environment variable is not set" };
        }
        if (!fs.existsSync(astPath)) {
            return { error: `AST file not found at path: ${astPath}` };
        }

        const astContent = JSON.parse(fs.readFileSync(astPath, "utf-8"));


        return { symbols, nodes: astContent };
    },
});

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

You will be provided with following inputs:

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
    -First, analyze the user's query and the Project Summary (<bal_md>).
    -Thought:What is the user's primary goal? Am I creating a new feature, modifying existing code, or fixing a bug?
    -Analysis: Use the <bal_md> content to get a high-level overview of the project summary to identify which parts of the codebase are relevant.
    - When you get the relevent code try to do not missed any context.This is the heart of the
    - If you can get the idea about only using bal.md you can skip the tool

2. Fetch Exact Code Context with the AST Tool

    - Thought:Based on my goal, do I need to see the exact source code of a symbol mentioned in the query or <bal_md>? if not skip the tool try to skil calling tool.
    - Action: Call the getASTContext tool with the list of symbols. The tool will return the ground-truth AST nodes for those symbols and all their dependencies. If the request is to create a completely new file, you can skip this tool call.

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
Its better to print the feedback in the below of your response
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

async function main() {
    try {
        const userQuery = process.env.USER_QUERY;

        if (!userQuery || !userQuery.trim()) {
            console.error(
                "[ERROR] USER_QUERY environment variable is not set or empty."
            );
            process.exit(1);
        }

        const { text: response } = await generateBallerinaCode(userQuery, [
            API_DOC,
        ]);

        const outputDir = path.join(process.cwd(), "poc");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const outputPath = path.join(outputDir, `${timestamp}.txt`);

        let finalContent = `=== USER QUERY ===\n${userQuery}\n\n=== RESPONSE ===\n${response}`;

        fs.writeFileSync(outputPath, finalContent, "utf-8");
        console.log(`\nOutput saved to ${outputPath}\n`);
    } catch (error) {
        console.error("Error generating Ballerina code:", error);
    }
}

main();

export { generateBallerinaCode };
