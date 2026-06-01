# Temperature Sensor MCP Server

## What This Does
- Provides temperature sensor data via MCP
- Simulates Cold Brew equipment sensors
- Available tools:
  - read_temperature: Get sensor reading
  - get_all_sensors: Get all sensor status
  - check_temperature_range: Validate safe range

## Architecture
Claude Code Agent
    ↓
MCP Server (this code)
    ↓
Temperature Sensors
This server will be integrated with Claude Code to:
Monitor Cold Brew equipment
Alert on unsafe conditions
Optimize DBD chamber parameters
Learn from production data
