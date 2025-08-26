# POC: Ballerina Copilot for Agentic Codebase Indexing

An intelligent AI-powered tool that generates Ballerina code based on user queries, leveraging API documentation and project context to create accurate, functional code.

## Features

- **AI-Powered Code Generation**: Uses Anthropic's Claude Haiku model to generate Ballerina code
- **Context-Aware**: Analyzes existing project files to understand codebase structure
- **API Documentation Integration**: Leverages comprehensive API docs and language libraries
- **Intelligent Code Extraction**: Extracts relevant code segments from existing files
- **Project-Specific Guidelines**: Incorporates project summary (bal.md) for tailored code generation

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
bun add ai @ai-sdk/anthropic zod
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
API_DOC_JSON=/path/to/api-documentation.json
BAL_MD_PATH=/path/to/project/bal.md
PROJECT_PATH=/path/to/ballerina/project
USER_QUERY="Your code generation query here"
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Environment Variable Details

- **API_DOC_JSON**: Path to JSON file containing Ballerina API documentation
- **BAL_MD_PATH**: Path to project summary markdown file (bal.md)
- **PROJECT_PATH**: Root directory of your Ballerina project containing .bal files
- **USER_QUERY**: The query describing what code you want to generate
- **ANTHROPIC_API_KEY**: Your Anthropic API key for Claude access

## Usage

### Basic Usage

```bash
bun start
```

### Example Queries

```bash
# Generate a REST API service
USER_QUERY="Create a REST API service for user management with CRUD operations"

# Generate database integration
USER_QUERY="Create a function to connect to MySQL database and fetch user data"

# Generate GraphQL service
USER_QUERY="Create a GraphQL service for product management"
```


## How It Works

### 1. Context Analysis
The tool first analyzes your project by:
- Reading the project summary from `bal.md`
- Understanding project architecture and guidelines
- Identifying relevant existing code files

### 2. Code Extraction
When needed, the `extractRelevantContentWithLLM` tool:
- Scans all `.bal` files in the project directory
- Uses AI to extract only relevant code segments
- Provides context for modifications or integrations

### 3. Code Generation
The AI generates Ballerina code by:
- Following project-specific guidelines from `bal.md`
- Using only APIs and functions from provided documentation
- Ensuring proper error handling and type safety
- Following Ballerina best practices and conventions

### 4. Output Generation
Results are saved to timestamped files containing:
- Original user query
- Generated code with explanations
- Token usage statistics

## Code Generation Rules

The tool follows strict guidelines to ensure high-quality code:

- **API Compliance**: Only uses functions and types from provided API documentation
- **Type Safety**: Explicit type declarations and proper error handling
- **Naming Conventions**: Two-word camelCase identifiers
- **Import Management**: Proper import statements with aliases for packages containing dots
- **Resource Functions**: Correct syntax for client resource function calls
- **JSON Handling**: Always converts JSON to records before manipulation
- **Configuration**: Uses configurable variables for external parameters

## Output Files

### Main Output
- Location: `poc/YYYY-MM-DDTHH-mm-ss-sssZ.txt`
- Contains: User query, generated response, and token usage statistics

### Code Extraction Reports
- Location: `code-extract/code_extract_symbols_timestamp.md`
- Contains: Extracted relevant code segments in markdown format

## Example Output Structure

```
=== USER QUERY ===
Create a REST API service for user management

=== RESPONSE ===
[Detailed explanation of the approach]

<code filename="main.bal">
```ballerina
import ballerina/http;
// Generated code here...
```
</code>

=== TOKEN USAGE ===
Input Tokens: 1500
Output Tokens: 800
Total Counted Tokens: 2300
```

## API Integration

The tool integrates with:
- **Anthropic Claude**: For AI-powered code generation
- **Ballerina API Docs**: For accurate function and type usage
- **Language Libraries**: For built-in Ballerina functionality

## Best Practices

1. **Clear Queries**: Provide specific, detailed requirements in your USER_QUERY
2. **Project Context**: Maintain an up-to-date `bal.md` file with project guidelines
3. **API Documentation**: Ensure API documentation JSON is comprehensive and current
4. **Code Review**: Always review generated code before integration
5. **Testing**: Test generated code in your development environment

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all required environment variables are set
   - Check file paths are correct and accessible

2. **Empty bal.md File**
   - Verify the bal.md file exists and contains project information
   - Check file permissions

3. **No .bal Files Found**
   - Verify PROJECT_PATH points to correct directory
   - Ensure directory contains .bal files

4. **API Key Issues**
   - Verify ANTHROPIC_API_KEY is valid and has sufficient credits
   - Check network connectivity

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=true bun run start
```

## Token Usage

The tool tracks and reports:
- Input tokens (query + context)
- Output tokens (generated code)
- Total token consumption

This helps monitor API usage and costs.

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

**Note**: This tool requires active Anthropic API access and is designed specifically for Ballerina code generation. Ensure your API key has sufficient credits for your usage needs.