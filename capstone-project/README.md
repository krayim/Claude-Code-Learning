# Cold Brew Production Management System

## Overview
**Full-featured AI system for Cold Brew Coffee production**

Combines:
- Week 1: Basic agents
- Week 2: Tool use & error handling
- Week 3: State management
- Week 4: MCP integration

## System Architecture
┌─────────────────────────────────────────┐
│  Claude Code Production Manager Agent   │
│  (Stateful, learns from history)        │
└──────────┬──────────────────────────────┘
           │
    ┌──────┴──────┬──────────┬─────────┐
    ▼             ▼          ▼         ▼
  Tools      State         Error      MCP
  (Database) (JSON)      Handling    (Sensors)
    │         │            │          │
    ▼         ▼            ▼          ▼
┌─────────────────────────────────────────┐
│  External Systems & Data                │
│  - Production logs                      │
│  - Temperature sensors                  │
│  - Equipment status                     │
│  - Quality metrics                      │
└─────────────────────────────────────────┘
Features
1. Intelligent Production Planning
Recipe optimization based on history
Ingredient availability checking
Cost calculation with error recovery
2. Real-time Monitoring
Temperature sensor integration (MCP)
Equipment status tracking
Safety alerts
3. Persistent Memory
Production history
Quality trends analysis
Learning from past batches
Recommendation engine
4. Error Handling
Retry logic for failed operations
Graceful degradation
Fallback strategies
How to Run
Start MCP Server (Terminal 1)
