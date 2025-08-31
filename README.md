# POC: Ballerina Copilot for Agentic Codebase Indexing

An intelligent AI-powered tool that generates Ballerina code based on user queries, leveraging API documentation and project context to create accurate, functional code. Now includes automated project documentation generation capabilities.

## Features

- **AI-Powered Code Generation**: Uses Anthropic's Claude models to generate Ballerina code
- **Context-Aware**: Analyzes existing project files to understand codebase structure
- **API Documentation Integration**: Leverages comprehensive API docs and language libraries
- **Intelligent Code Extraction**: Extracts relevant code segments from existing files
- **Project-Specific Guidelines**: Incorporates project summary (bal.md) for tailored code generation
- **Automated Documentation**: Generates comprehensive project summaries (bal.md) from existing Ballerina codebases

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

### For Code Generation

Create a `.env` file with the following variables:

```env
# Required for Code Generation
API_DOC_JSON=/path/to/api-documentation.json
BAL_MD_PATH=/path/to/project/bal.md
PROJECT_PATH=/path/to/ballerina/project
USER_QUERY="Your code generation query here"
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### For Documentation Generation

```env
# Required for bal.md Generation
BAL_PROJECT_PATH=/path/to/ballerina/project
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Environment Variable Details

- **API_DOC_JSON**: Path to JSON file containing Ballerina API documentation
- **BAL_MD_PATH**: Path to project summary markdown file (bal.md)
- **PROJECT_PATH**: Root directory of your Ballerina project containing .bal files (for code generation)
- **BAL_PROJECT_PATH**: Root directory of your Ballerina project (for documentation generation)
- **USER_QUERY**: The query describing what code you want to generate
- **ANTHROPIC_API_KEY**: Your Anthropic API key for Claude access

## Usage

### Code Generation

```bash
bun start
```

### Documentation Generation

Generate a comprehensive project summary (bal.md) from your existing Ballerina codebase:

```bash
bun run generate-balmd
```

### Example Code Generation Queries

```bash
# Generate a REST API service
USER_QUERY="Create a REST API service for user management with CRUD operations"

# Generate database integration
USER_QUERY="Create a function to connect to MySQL database and fetch user data"

# Generate GraphQL service
USER_QUERY="Create a GraphQL service for product management"
```

## How It Works

### 1. Documentation Generation (bal.md)
The `generateBalMd` function:
- Recursively scans all `.bal` files in the project directory
- Analyzes each file's structure and content using Claude
- Generates a comprehensive markdown summary organized by:
  - File-level imports
  - Configurable level variables
  - Module level variables
  - Type definitions (records, enums)
  - Function definitions
  - Service definitions
  - Resource function definitions
- Saves timestamped documentation to `balmd-generate/` folder

### 2. Context Analysis
The code generation tool analyzes your project by:
- Reading the project summary from `bal.md`
- Understanding project architecture and guidelines
- Identifying relevant existing code files

### 3. Code Extraction
When needed, the `extractRelevantContentWithLLM` tool:
- Scans all `.bal` files in the project directory
- Uses AI to extract only relevant code segments
- Provides context for modifications or integrations

### 4. Code Generation
The AI generates Ballerina code by:
- Following project-specific guidelines from `bal.md`
- Using only APIs and functions from provided documentation
- Ensuring proper error handling and type safety
- Following Ballerina best practices and conventions

### 5. Output Generation
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

### Code Generation Output
- Location: `poc/YYYY-MM-DDTHH-mm-ss-sssZ.txt`
- Contains: User query, generated response, and token usage statistics

### Documentation Generation Output
- Location: `balmd-generate/balYYYYMMDD_HHMMSS.md`
- Contains: Comprehensive project summary organized by file structure

### Code Extraction Reports
- Location: `code-extract/code_extract_symbols_timestamp.md`
- Contains: Extracted relevant code segments in markdown format

## Example Output Structure

### Code Generation Output
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

### Documentation Generation Output
```markdown
## main.bal

### Imports
- import ballerina/http
- import ballerina/sql

### Configurable Level Variables
- configurable string DB_HOST = "localhost"

### Module Level Variables
- http:Client userClient

### Types
- UserRecord: { string name, int age, string email }

### Functions
- getUserById(int id) returns UserRecord|error

### Services
- UserService on http:Listener(8080)

### Resources
- GET /users/{id} - Retrieve user by ID
```

## Workflow Recommendations

1. **Start with Documentation Generation**:
   ```bash
   BAL_PROJECT_PATH=/path/to/your/project bun run generate-balmd
   ```

2. **Use Generated Documentation for Code Generation**:
   ```bash
   BAL_MD_PATH=/path/to/generated/bal.md USER_QUERY="Your query" bun start
   ```

3. **Iterate and Refine**:
   - Update your codebase
   - Regenerate documentation as needed
   - Use updated documentation for better code generation

## API Integration

The tool integrates with:
- **Anthropic Claude**: For AI-powered code generation and documentation
- **Ballerina API Docs**: For accurate function and type usage
- **Language Libraries**: For built-in Ballerina functionality

## Best Practices

1. **Clear Queries**: Provide specific, detailed requirements in your USER_QUERY
2. **Project Context**: Maintain an up-to-date `bal.md` file with project guidelines
3. **API Documentation**: Ensure API documentation JSON is comprehensive and current
4. **Code Review**: Always review generated code before integration
5. **Testing**: Test generated code in your development environment
6. **Documentation Updates**: Regenerate bal.md when project structure changes significantly

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all required environment variables are set
   - Check file paths are correct and accessible

2. **Empty bal.md File**
   - Use the documentation generation feature to create one
   - Verify the bal.md file exists and contains project information
   - Check file permissions

3. **No .bal Files Found**
   - Verify PROJECT_PATH/BAL_PROJECT_PATH points to correct directory
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
- Tool call tokens (for code extraction)
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

**Note**: This tool requires active Anthropic API access and is designed specifically for Ballerina code generation and documentation. Ensure your API key has sufficient credits for your usage needs.