import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs';
import path from 'path';

interface BalFile {
    filePath: string;
    content: string;
}

function getAllBalFiles(dirpath: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dirpath);

    files.forEach((file) => {
        const filePath = path.join(dirpath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            getAllBalFiles(filePath, fileList);
        } else if (file.endsWith('.bal')) {
            fileList.push(filePath);
        }
    });

    console.log(fileList);
    return fileList;
}

function readBalFiles(filePaths: string[]): BalFile[] {
    return filePaths.map((filePath) => ({
        filePath,
        content: fs.readFileSync(filePath, 'utf-8')
    }));
}

export async function generateBalMd(balFiles: BalFile[]) {
    const systemPrompt = `
You are an expert Ballerina developer and technical writer. Your task is to generate a clear, well-structured Markdown summary of a Ballerina project (bal.md) based on the project file contents provided.

Each file has this structure:
- filePath: string – the file path
- content: string – the complete file content

Instructions:

Rule: Use only **actual code symbols and keywords**. Include doc comments and inline comments from the code, correcting grammar and spelling as needed.
      Be **minimal**: include only relevant sections and information; do not add extra explanations.

1. Analyze the code and determine the logical structure:
- Project files and their purposes
- Imports used in each file
- Global variables, in-memory maps, constants, or any other data structures
- Services, listeners, and endpoints
- Resource functions with methods, paths, descriptions, responses, and validations
- Record types, enums, and any custom types

2. Generate a Markdown summary that reflects the actual project structure. Use headings, subheadings, bullet points, and code blocks as appropriate.

3. Only include sections relevant to the project; omit sections that don't exist.

4. Be concise, accurate, and structured in a way that a developer can understand the entire project at a glance.

The output should look professional and follow this style (dynamic, based on the actual project, not hardcoded):

# {Project Name} - Project Structure

## Project Files
- List files and their purpose

## Imports
- List imports used in the project

## Global Variables / Data Structures
- List relevant variables, maps, or constants

## Services / Listeners
- List services, listeners, and descriptions

## Resource Functions
- Method, path, description, responses, validations

## Types
- Record types, enums, and fields
- Include optional fields if any
`;

    // Send request to the LLM
    const response = await generateText({
        model: anthropic('claude-3-5-haiku-20241022'),
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(balFiles, null, 2) }
        ]
    });

    const outputText = response.text;

    const outputDir = path.join(process.cwd(), 'balmd-generate');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const now = new Date();
    const fileName = `bal${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.md`;

    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, outputText, 'utf-8');

    console.log(`bal.md generated and saved at: ${filePath}`);
    return filePath;
}

const projectPath = process.env.BAL_PROJECT_PATH;
if (!projectPath) {
    throw new Error("Environment variable BAL_PROJECT_PATH is not set.");
}

const balFilePaths = getAllBalFiles(projectPath);
const balFiles = readBalFiles(balFilePaths);
generateBalMd(balFiles);