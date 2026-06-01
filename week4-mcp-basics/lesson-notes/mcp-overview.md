# Week 4: MCP (Model Context Protocol) & Integration

## What is MCP?
- **Protocol**: How Claude Code talks to external tools
- **Server-Client**: MCP server provides resources, Claude Code is client
- **Use Cases**: 
  - Connect databases
  - Control hardware
  - Access APIs
  - Real-time data

## Architecture
Claude Code Agent
    ↓ (requests via JSON-RPC)
MCP Server (your code)
    ↓ (accesses)
External Systems (DB, hardware, APIs)
## Key Components
1. **Resources**: Data/files MCP provides
2. **Tools**: Functions Claude Code can call
3. **Prompts**: Pre-written prompt templates

## Real-world: Cold Brew DBD System
- MCP server monitors DBD chamber
- Provides temperature, voltage, frequency
- Claude Code controls parameters
- Agent learns optimal settings

