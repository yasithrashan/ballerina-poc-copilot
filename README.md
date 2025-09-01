# POC: Ballerina Copilot for Agentic Codebase Indexing

An intelligent AI-powered tool that generates Ballerina code based on user queries, leveraging API documentation and project context to create accurate, functional code. Includes automated project documentation generation and intelligent code extraction capabilities.

## Features

- **AI-Powered Code Generation**: Uses Anthropic's Claude models to generate Ballerina code
- **Context-Aware**: Analyzes existing project files to understand codebase structure
- **API Documentation Integration**: Leverages comprehensive API docs and language libraries
- **Intelligent Code Extraction**: Extracts relevant code segments from existing files
- **Project-Specific Guidelines**: Incorporates project summary (bal.md) for tailored code generation
- **Automated Documentation**: Generates comprehensive project summaries (bal.md) from existing Ballerina codebases
- **Real Token Tracking**: Uses Anthropic's official API for accurate token counting and cost monitoring

## Architecture

The tool consists of three main components:

1. **Code Generator** (`index.ts`) - Main AI-powered code generation engine
2. **Documentation Generator** (`generate-balmd.ts`) - Automated project documentation creator
3. **Code Extractor** (`extract-relevant-code.ts`) - Intelligent code segment extraction tool

## Prerequisites

- Bun (v1.0 or higher)
- TypeScript
- Anthropic API key
- Ballerina project structure

## Installation

1. Clone the repository
2. Install dependencies:
```bash
bun install
```

3. Install required packages:
```bash
bun add ai @ai-sdk/anthropic zod @anthropic-ai/sdk
```

## Environment Variables

### For Code Generation (`index.ts`)

```env
# Required for Code Generation
API_DOC_JSON=/path/to/api-documentation.json
BAL_MD_PATH=/path/to/project/bal.md
PROJECT_PATH=/path/to/ballerina/project
USER_QUERY="Your code generation query here"
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional for code extraction
EXTRACT_FILE_PATH=/path/to/extracted/code.md
```

### For Documentation Generation (`generate-balmd.ts`)

```env
# Required for bal.md Generation
BAL_PROJECT_PATH=/path/to/ballerina/project
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### For Code Extraction (`extract-relevant-code.ts`)

```env
# Required for Code Extraction
PROJECT_PATH=/path/to/ballerina/project
BAL_MD_PATH=/path/to/project/bal.md
USER_QUERY="Query describing what code to extract"
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Environment Variable Details

- **API_DOC_JSON**: Path to JSON file containing Ballerina API documentation
- **BAL_MD_PATH**: Path to project summary markdown file (bal.md)
- **PROJECT_PATH**: Root directory of your Ballerina project containing .bal files
- **BAL_PROJECT_PATH**: Root directory of your Ballerina project (for documentation generation)
- **USER_QUERY**: The query describing what code you want to generate or extract
- **ANTHROPIC_API_KEY**: Your Anthropic API key for Claude access
- **EXTRACT_FILE_PATH**: Optional path to manually extracted code file

## Usage

### 1. Documentation Generation

Generate a comprehensive project summary (bal.md) from your existing Ballerina codebase:

```bash
bun run generate-balmd.ts
```

### 2. Code Extraction

Extract relevant code segments based on your query:

```bash
bun run extract-relevant-code.ts
```

### 3. Code Generation

Generate new Ballerina code based on your requirements:

```bash
bun run index.ts
```

### Recommended Workflow

1. **Start with Documentation Generation**:
   ```bash
   BAL_PROJECT_PATH=/path/to/your/project bun run generate-balmd.ts
   ```

2. **Extract Relevant Code Context** (if modifying existing code):
   ```bash
   PROJECT_PATH=/path/to/your/project BAL_MD_PATH=/path/to/generated/bal.md USER_QUERY="Your extraction query" bun run extract-relevant-code.ts
   ```

3. **Generate Code**:
   ```bash
   BAL_MD_PATH=/path/to/generated/bal.md EXTRACT_FILE_PATH=/path/to/extracted/code.md USER_QUERY="Your generation query" bun run index.ts
   ```

## Example Queries

### Code Generation Queries
```bash
# Generate a REST API service
USER_QUERY="Create a REST API service for user management with CRUD operations"

# Generate database integration
USER_QUERY="Create a function to connect to MySQL database and fetch user data"

# Generate GraphQL service
USER_QUERY="Create a GraphQL service for product management"
```

### Code Extraction Queries
```bash
# Extract user-related functions
USER_QUERY="Find all functions related to user authentication and validation"

# Extract database operations
USER_QUERY="Extract all database connection and query functions"
```

## How It Works

### 1. Documentation Generation (`generate-balmd.ts`)
- Recursively scans all `.bal` files in the project directory
- Analyzes each file's structure and content using Claude Sonnet 4
- Generates a comprehensive markdown summary organized by:
  - Project overview and file listing
  - File-level imports and configurations
  - Module level variables
  - Type definitions (records, enums)
  - Function definitions with parameters and return types
  - Service definitions with endpoints
  - Resource function definitions
- Saves timestamped documentation to `balmd-generate/` folder

### 2. Code Extraction (`extract-relevant-code.ts`)
- Reads the project documentation (bal.md) to understand project structure
- Analyzes all `.bal` files in the project
- Uses AI to identify and extract code segments relevant to the user query
- Generates structured markdown reports with extracted code
- Saves results to `code-extract/` folder with timestamps

### 3. Code Generation (`index.ts`)
- Analyzes project context from bal.md and extracted code
- Uses comprehensive API documentation for accurate function usage
- Employs advanced prompt engineering for high-quality code generation
- Tracks token usage with Anthropic's official API for cost monitoring
- Generates complete, functional Ballerina code with proper error handling
- Saves results with detailed token usage statistics

## Output Files

### Documentation Generation Output
- **Location**: `balmd-generate/balYYYYMMDD_HHMMSS.md`
- **Contains**: Comprehensive project summary organized by file structure

### Code Extraction Output
- **Location**: `code-extract/extract_YYYY-MM-DDTHH-mm-ss-sssZ.md`
- **Contains**: Relevant code segments formatted as structured markdown report

### Code Generation Output
- **Location**: `poc/YYYY-MM-DDTHH-mm-ss-sssZ.txt`
- **Contains**: Generated code with explanations and detailed token usage statistics
- **Additional**: `*_tokens.json` file with machine-readable token usage data

## Token Usage Tracking

The tool provides comprehensive token usage tracking including:

- **User Query Tokens**: Tokens for the input query
- **LangLibs Tokens**: Tokens for Ballerina language libraries
- **API Docs Tokens**: Tokens for API documentation
- **Bal.md Tokens**: Tokens for project documentation
- **Extract Code Tokens**: Tokens for extracted code context
- **Total Input Tokens**: Complete input token count
- **Output Tokens**: Generated response token count

This helps monitor API usage and costs effectively.

## Code Generation Rules

The tool follows strict guidelines to ensure high-quality code:

- **API Compliance**: Only uses functions and types from provided API documentation
- **Type Safety**: Explicit type declarations and proper error handling
- **Naming Conventions**: Two-word camelCase identifiers
- **Import Management**: Proper import statements with aliases for packages containing dots
- **Resource Functions**: Correct syntax for client resource function calls
- **JSON Handling**: Always converts JSON to records before manipulation
- **Configuration**: Uses configurable variables for external parameters

## Advanced Features

### Real Token Counting
Uses Anthropic's official token counting API for accurate cost tracking and optimization.

### Intelligent Context Analysis
Combines project documentation, extracted code, and API documentation for comprehensive context awareness.

### Tool Integration
Supports tool calls for dynamic code extraction during generation process.

### Error Handling
Comprehensive error handling with detailed logging and graceful fallbacks.

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all required environment variables are set for each script
   - Check file paths are correct and accessible

2. **Empty bal.md File**
   - Run the documentation generation script first
   - Verify the project contains .bal files
   - Check file permissions

3. **No .bal Files Found**
   - Verify PROJECT_PATH/BAL_PROJECT_PATH points to correct directory
   - Ensure directory contains .bal files

4. **API Key Issues**
   - Verify ANTHROPIC_API_KEY is valid and has sufficient credits
   - Check network connectivity

5. **Token Limit Exceeded**
   - Monitor token usage with the provided tracking
   - Consider breaking large projects into smaller segments

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=true bun run <script-name>
```

## Models Used

- **Documentation Generation**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **Code Extraction**: Claude Sonnet 3.5 (`claude-3-5-sonnet-20240620`)
- **Code Generation**: Claude Haiku (configurable via `ANTHROPIC_HAIKU`)

## API Integration

The tool integrates with:
- **Anthropic Claude**: For AI-powered code generation and documentation
- **Ballerina API Docs**: For accurate function and type usage
- **Language Libraries**: For built-in Ballerina functionality
- **Token Counting API**: For real-time usage tracking

## Best Practices

1. **Sequential Workflow**: Use documentation → extraction → generation workflow
2. **Clear Queries**: Provide specific, detailed requirements in your queries
3. **Project Maintenance**: Keep documentation updated with project changes
4. **API Documentation**: Ensure API documentation JSON is comprehensive and current
5. **Code Review**: Always review generated code before integration
6. **Testing**: Test generated code in your development environment
7. **Token Monitoring**: Monitor token usage to manage API costs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review environment variable configuration

---

**Note**: This tool requires active Anthropic API access and is designed specifically for Ballerina code generation and documentation. Ensure your API key has sufficient credits for your usage needs.