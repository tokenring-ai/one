# Documentation Knowledge Repository

This file maintains knowledge about documentation standards, patterns, and structure in the Token Ring project.

## 1. Documentation Hierarchy and Structure

### Root Level Documentation
- **README.md**: Main project overview with the TokenRing One application, quick start, package ecosystem overview
- **PACKAGES.md**: Comprehensive package index with 50+ packages organized by category
- **DEPENDENCIES.md**: Dependency graph and relationships
- **AGENTS.md**: Agent definitions and capabilities

### Package-Level Documentation
- **Individual README.md files**: Each of the 50+ packages has its own detailed README
- **Consistent structure across all packages**:
 - Overview/Purpose
 - Features
 - Chat Commands (optional)
 - Tools (optional)
 - Configuration
   - Sample Configuration in YAML format
   - ENV Variables (optional)
 - License

### Application-Level Documentation
- **backend/README.md**: Comprehensive TokenRing One application (coding, content creation, research, automation; 50-package ecosystem)
- **app/webterminal/README.md**: Lightweight coding terminal interface

### Plugin Documentation
- **Website Documentation**: `docs/docs/plugins/<package-name>.md`
- **Consistent structure across all plugins**:
 - User Guide: 
   - Overview and Purpose
   - Key Features
   - Chat Commands: Document slash-prefixed commands available in the package
   - Tools: Document tools available in the package
   - Configuration
   - Sample Configuration in YAML format
   - ENV Variables (optional)
 - Developer Reference:
   - Core Components
   - Services: Documentation of TokenRingService implementations
   - Provider Documentation: If applicable, document provider interfaces
   - RPC Endpoints: If applicable, document RPC endpoints
   - Usage Examples

## 2. Documentation Writing Standards

### Technical Writing Standards
- **Consistent Terminology**: Uses "Agent", "Service", "Tool", "Command" consistently across all documentation
- **Type-Safe Examples**: All code examples use proper TypeScript types and imports
- **YAML Configuration**: Consistent use of YAML for configuration examples
- **Tech Stack**: Packages use bun, vitest, and typescript
- **Command Systems**: Detailed documentation of chat command patterns and usage

### 1. Documentation standards for README.md
```markdown
# Plugin Name

## Overview
- Brief description of functionality
- Key features list with bullet points
- Integration points with other packages

## Installation
- Package installation command
- Dependencies list

## Features
- Bullet-point list of main capabilities

## Chat Commands
- Include this section if the package defines slash commands
- Markdown table with commands

## Tools
- Include this section if the package defines tools
- Markdown table with tools

## Configuration
- Include this section if the package defines configuration
- Markdown table with any ENV Variables (optional)
- Configuration options and schemas
- Configuration example (YAML)

## License

MIT License - see LICENSE file for details.
```

### 2. Documentation Website Standards
Each package will maintain up-to-date user documentation on the documentation website, which will be placed in `docs/docs/plugins/<package-name>.md`

#### File Naming and Organization
- **Package overview**: `docs/docs/plugins/<package-name>.md`
- **Consistent naming**: Use hyphenated lowercase names (e.g., `token-ring-app.md`)
- **CLI Plugin**: `cli.md` (not `cli-plugin.md` or `command-line-interface.md`)
  
#### Content Structure
Each documentation file should follow a two-part structure, with a **User Guide** and a **Developer Reference** section:
- **User Guide**:
 1. **Title and Overview**: Clear title and brief description
 2. **Key Features**: Bullet-point list of main capabilities
 3. **Chat Commands**: Document slash-prefixed commands available in the interface
 4. **Tools**: Document tools available in the package
 5. **Configuration**: Configuration options and schemas
 6. **Integration**: How the component integrates with other packages
 7. **Best Practices**: Recommendations for usage
- **Developer Reference**:
 1. **Core Components**: Detailed breakdown of main classes, interfaces, and functions
 2. **Services**: Documentation of TokenRingService implementations
 3. **Provider Documentation**: If applicable, document provider interfaces
 4. **RPC Endpoints**: If applicable, document RPC endpoints
 5. **Usage Examples**: Practical code examples
 6. **Testing**: Testing setup and examples
 7. **Dependencies**: Package dependencies and version requirements
 8. **Related Components**: Cross-references to related components

#### Code Examples
- Use TypeScript syntax with proper imports
- Use YAML for configuration examples

#### Markdown Formatting Guidelines
- **Line Length**: Keep lines under 80 characters where practical for readability (MD013)
- **Table Formatting**: 
  - Use compact style with spaces around pipe characters: `| Column | Column |`
  - Align table columns consistently (MD060)
  - Ensure header, separator, and data rows align properly
- **Fenced Code Blocks**: Always specify language identifier (e.g., ` ```typescript `, ` ```yaml `) (MD040)
- **Headings**: Avoid duplicate heading text within the same document (MD024)
  - If duplicate headings are necessary, make them unique (e.g., "Error Handling" vs "Error Handling in Tools")

#### Schema Documentation
When documenting schema definitions:
- Include all exported Zod schemas with their purpose
- Document complex schemas by grouping related fields (e.g., "Core identification fields", "Price fields")
- Provide code examples showing schema definitions
- Include notes about automatic transformations or conversions

#### Scripting Functions Documentation
When a package registers global functions with the ScriptingService:
- Document each function with its signature and parameters
- Include example usage in Javascript contexts
- Note that functions are automatically registered by the plugin
- Document return types and any error conditions

#### Command Aliases Documentation
When commands have aliases (defined via the `alias` property in command definitions):
- Document the primary command name in the table
- List aliases in the description column (e.g., "Alias: `/func delete`")
- Include the most commonly used alias in examples if it differs from the primary name
- Document all aliases to ensure users can find the command regardless of which name they use

#### Table Cell Escaping
When table cells contain pipe characters (`|`):
- Use `\x7C` to represent pipe characters within table cells to avoid breaking the table structure
- Example: `/echo text\x7C$var` instead of `/echo text|$var`
- This prevents the pipe from being interpreted as a column separator

#### Artifact Output Documentation
When a package generates artifacts (e.g., research results, search results):
- Document the artifact properties (name, encoding, mimeType, body)
- Provide the artifact structure or format
- Explain when and how artifacts are generated

#### State Management Documentation
When documenting service state:
- Document whether the service maintains persistent state
- List any state that is maintained and how it is managed
- Document state serialization/deserialization if applicable
- Note if the service is stateless (each request processed independently)

### 3. Documentation Maintenance

#### Update Process
1. **Analyze current functionality**: Review plugin source code and implementation
2. **Compare with existing documentation**: Identify discrepancies and missing information
3. **Update README**: Modify or create README if needed to match current functionality
4. **Update website**: Update website documentation to match current functionality

#### Documentation Standards Enforcement
- **Consistency**: Ensure consistent terminology and formatting across all documentation
- **Accuracy**: Verify that all examples and code snippets are current and functional
- **Completeness**: Ensure all features and APIs are documented
- **Maintainability**: Use modular documentation structure that's easy to update
- **Accessibility**: Ensure documentation is clear and understandable to both technical and non-technical audiences

#### Documentation Tools
- **File System**: Use the filesystem tools to search for and update documentation files
- **Code Analysis**: Review source code to understand current functionality
- **Structure Verification**: Verify that documentation follows the established patterns
