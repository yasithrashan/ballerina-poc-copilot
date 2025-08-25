import { generateText, stepCountIs, tool } from "ai";
import {
    ANTHROPIC_SONNET_3_5,
    ANTHROPIC_HAIKU,
    ANTHROPIC_SONNET_4,
    getAnthropicClinet,
} from "./connection";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import type { Library } from "./libs/types";
import { LANGLIBS } from "./libs/langlibs";
import path from "path";
import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const jsonPath = process.env.API_DOC_JSON;
if (!jsonPath) {
    throw new Error("Missing environment variable: API_DOC_JSON");
}

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
    const systemPrompt =
        getSystemPromptPrefix(API_DOC) +
        "\n\n" +
        getSystemPromptSuffix(LANG_LIB) +
        "\n\n" +
        getSystemPromptBalMd(balMdContent);

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
        stopWhen: stepCountIs(50),
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
                "An array of Ballerina symbols (functions, types, etc.) to fetch from the AST."
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

        // Build indices for fast lookups
        const nodeMapById = new Map<string, any>();
        const nodesByName = new Map<string, any[]>();
        const relationships = astContent.dependency_graph?.relationships || {};
        const endpoints = astContent.dependency_graph?.endpoints || {};

        const indexNode = (node: any) => {
            if (!node || typeof node !== "object") return;
            if (node.id) nodeMapById.set(node.id, node);
            if (node.name && typeof node.name === "string") {
                if (!nodesByName.has(node.name)) nodesByName.set(node.name, []);
                nodesByName.get(node.name)!.push(node);
            }
            for (const key in node) {
                const value = node[key];
                if (Array.isArray(value)) value.forEach(indexNode);
                else if (typeof value === "object") indexNode(value);
            }
        };
        if (astContent.modules) {
            astContent.modules.forEach((mod: any) => indexNode(mod));
        }

        // Initial nodes for the given symbols
        const initialNodeIds = new Set<string>();
        for (const symbol of symbols) {
            if (nodesByName.has(symbol)) {
                nodesByName.get(symbol)!.forEach(node => {
                    if (node.id) initialNodeIds.add(node.id);
                });
            }
        }

        // Dependency resolution (forward + reverse)
        const contextIds = new Set<string>(initialNodeIds);
        const worklist = [...initialNodeIds];

        const findDependenciesInNode = (node: any) => {
            if (!node || typeof node !== "object") return;
            const dependencyKeys = ['resolvesTo', 'typeResolvesTo'];
            for (const key of dependencyKeys) {
                if (node[key] && typeof node[key] === 'string') {
                    const depId = node[key];
                    if (!contextIds.has(depId)) {
                        contextIds.add(depId);
                        worklist.push(depId);
                    }
                }
            }
            for (const key in node) {
                const value = node[key];
                if (Array.isArray(value)) value.forEach(findDependenciesInNode);
                else if (typeof value === "object") findDependenciesInNode(value);
            }
        };

        // Reverse dependencies
        const findReverseDependencies = (targetIds: Set<string>) => {
            const reverseMatches: string[] = [];
            for (const [id, node] of nodeMapById.entries()) {
                let found = false;
                const scanNode = (obj: any) => {
                    if (!obj || typeof obj !== "object" || found) return;
                    for (const key in obj) {
                        const val = obj[key];
                        if (typeof val === "string" && targetIds.has(val)) {
                            reverseMatches.push(id);
                            found = true;
                            break;
                        } else if (Array.isArray(val)) val.forEach(scanNode);
                        else if (typeof val === "object") scanNode(val);
                    }
                };
                scanNode(node);
            }
            return reverseMatches;
        };

        while (worklist.length > 0) {
            const currentId = worklist.shift()!;
            const currentNode = nodeMapById.get(currentId);
            if (currentNode) findDependenciesInNode(currentNode);
        }

        const reverseDeps = findReverseDependencies(initialNodeIds);
        reverseDeps.forEach(id => contextIds.add(id));

        // Build structured context
        const relevantNodes = [...contextIds].map(id => nodeMapById.get(id)).filter(Boolean);

        // Add additional related context from dependency_graph
        const relatedEndpoints = symbols
            .map(s => Object.entries(endpoints).filter(([ep, data]) => {
                if (
                    typeof data === "object" &&
                    data !== null &&
                    ("entity" in data || "operations" in data)
                ) {
                    const d = data as { entity?: string; operations?: string[] };
                    return d.entity === s || d.operations?.includes(s);
                }
                return false;
            }))
            .flat();

        const relatedRelationships = Object.entries(relationships)
            .filter(([_, rel]) => {
                const r = rel as { from?: string; to?: string };
                return symbols.includes(r.from ?? "") || symbols.includes(r.to ?? "");
            });

        // Prepare final structured result
        const result = {
            symbols,
            nodes: relevantNodes,
            endpoints: relatedEndpoints.length ? relatedEndpoints : undefined,
            relationships: relatedRelationships.length ? relatedRelationships : undefined,
            metadata: {
                source_files: astContent.project_structure?.source_files || [],
                imports: astContent.ast?.imports || [],
                dependencies: astContent.project_structure?.dependencies || {}
            }
        };

        // Save result to file
        const outputDir = path.resolve("./ast-context-results");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `ast-context-${timestamp}.txt`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");

        console.log("TOOL CALLED: getASTContext");
        console.log(`Context saved to ${filePath}`);
        console.log(`Found ${relevantNodes.length} nodes for symbols:`, symbols);

        return { ...result, savedTo: filePath };
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

2. Fetch Exact Code Context with the AST Tool
    CRITICAL: Do NOT guess or hallucinate the content of existing files, functions, or types. If the request involves modifying existing code, you MUST fetch its latest version first.
    - Thought:Based on my goal, do I need to see the exact source code of a symbol mentioned in the query or <bal_md>?
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

        const { text: response, usage } = await generateBallerinaCode(userQuery, [
            API_DOC,
        ]);

        const outputDir = path.join(process.cwd(), "src", "ai", "poc");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const outputPath = path.join(outputDir, `${timestamp}.txt`);

        // Include user query at the top of the output file
        let finalContent = `=== USER QUERY ===\n${userQuery}\n\n=== RESPONSE ===\n${response}`;

        if (usage) {
            const usageContent = [
                "\n\n=== Token Usage ===",
                `Input tokens : ${usage.inputTokens || "N/A"}`,
                `Output tokens: ${usage.outputTokens || "N/A"}`,
                `Total tokens : ${usage.totalTokens || "N/A"}`,
            ].join("\n");

            finalContent += usageContent;
        }

        fs.writeFileSync(outputPath, finalContent, "utf-8");
        console.log(`\nOutput with token usage saved to ${outputPath}\n`);
    } catch (error) {
        console.error("Error generating Ballerina code:", error);
    }
}

main();

export { generateBallerinaCode };
