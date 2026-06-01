require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simulated equipment database
const equipment = {
  fermenter_1: { temp: 22.5, status: "operational", last_check: "2026-05-31T10:00:00Z" },
  fermenter_2: { temp: 23.1, status: "operational", last_check: "2026-05-31T10:00:00Z" },
  bottler: { status: "maintenance", error: "Motor malfunction", last_check: "2026-05-30T15:00:00Z" },
  pasteurizer: { temp: 72.5, status: "operational", last_check: "2026-05-31T09:30:00Z" }
};

// Simulated network failures - randomly fail some requests
let requestCount = 0;
function shouldFail() {
  return Math.random() < 0.3; // 30% failure rate
}

// Tools
const tools = [
  {
    name: "get_equipment_status",
    description: "Get status of specific equipment",
    input_schema: {
      type: "object",
      properties: {
        equipment_id: {
          type: "string",
          description: "Equipment identifier (e.g., fermenter_1, bottler)"
        }
      },
      required: ["equipment_id"]
    }
  },
  {
    name: "get_temperature",
    description: "Get current temperature of equipment",
    input_schema: {
      type: "object",
      properties: {
        equipment_id: {
          type: "string",
          description: "Equipment identifier"
        }
      },
      required: ["equipment_id"]
    }
  },
  {
    name: "validate_equipment",
    description: "Validate if equipment is safe to operate",
    input_schema: {
      type: "object",
      properties: {
        equipment_id: {
          type: "string",
          description: "Equipment identifier"
        },
        temperature_min: {
          type: "number",
          description: "Minimum safe temperature"
        },
        temperature_max: {
          type: "number",
          description: "Maximum safe temperature"
        }
      },
      required: ["equipment_id", "temperature_min", "temperature_max"]
    }
  },
  {
    name: "alert_maintenance",
    description: "Send alert for maintenance required",
    input_schema: {
      type: "object",
      properties: {
        equipment_id: {
          type: "string",
          description: "Equipment identifier"
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "critical"],
          description: "Alert severity level"
        },
        message: {
          type: "string",
          description: "Alert message"
        }
      },
      required: ["equipment_id", "severity", "message"]
    }
  }
];

// Retry mechanism
async function callToolWithRetry(toolName, toolInput, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}`);
      
      // Simulate network failure
      if (shouldFail()) {
        throw new Error("Network error: Connection timeout");
      }

      const result = processToolCall(toolName, toolInput);
      console.log(`   ✅ Success`);
      return result;
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.log(`   💥 Failed after ${maxRetries} attempts - using fallback`);
        return getFallbackResult(toolName, toolInput);
      }
      
      // Wait before retry
      const waitTime = 500 * attempt;
      console.log(`   ⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Tool implementations
function processToolCall(toolName, toolInput) {
  switch (toolName) {
    case "get_equipment_status":
      const eq = equipment[toolInput.equipment_id];
      if (!eq) throw new Error(`Equipment ${toolInput.equipment_id} not found`);
      return JSON.stringify({
        equipment_id: toolInput.equipment_id,
        status: eq.status,
        details: eq
      });

    case "get_temperature":
      const temp_eq = equipment[toolInput.equipment_id];
      if (!temp_eq) throw new Error(`Equipment not found`);
      if (!temp_eq.temp) throw new Error(`Equipment has no temperature sensor`);
      return JSON.stringify({
        equipment_id: toolInput.equipment_id,
        temperature_celsius: temp_eq.temp,
        timestamp: new Date().toISOString()
      });

    case "validate_equipment":
      const val_eq = equipment[toolInput.equipment_id];
      if (!val_eq) throw new Error(`Equipment not found`);
      if (val_eq.status !== "operational") {
        return JSON.stringify({
          valid: false,
          reason: `Equipment status: ${val_eq.status}`,
          safe_to_operate: false
        });
      }
      const isSafe = val_eq.temp >= toolInput.temperature_min && 
                     val_eq.temp <= toolInput.temperature_max;
      return JSON.stringify({
        valid: isSafe,
        current_temp: val_eq.temp,
        min: toolInput.temperature_min,
        max: toolInput.temperature_max,
        safe_to_operate: isSafe
      });

    case "alert_maintenance":
      return JSON.stringify({
        alert_sent: true,
        equipment_id: toolInput.equipment_id,
        severity: toolInput.severity,
        timestamp: new Date().toISOString(),
        message: `Alert logged: ${toolInput.message}`
      });

    default:
      throw new Error("Unknown tool");
  }
}

// Fallback results when all retries fail
function getFallbackResult(toolName, toolInput) {
  switch (toolName) {
    case "get_equipment_status":
      return JSON.stringify({
        equipment_id: toolInput.equipment_id,
        status: "unknown",
        fallback: true,
        message: "Unable to retrieve status - using cached data"
      });
    case "get_temperature":
      return JSON.stringify({
        equipment_id: toolInput.equipment_id,
        temperature_celsius: null,
        fallback: true,
        message: "Temperature unavailable - sensor may be offline"
      });
    default:
      return JSON.stringify({
        error: "Tool call failed after retries",
        fallback: true
      });
  }
}

async function runAgent() {
  console.log("🤖 Equipment Monitor Agent (With Error Handling) Started...\n");

  const messages = [
    {
      role: "user",
      content: `You are a Cold Brew equipment monitoring system. 
      
Your job:
1. Check temperature of fermenter_1 and fermenter_2
2. Validate if fermenters are safe to operate (ideal range: 20-25°C)
3. Check status of bottler equipment
4. Check pasteurizer temperature (should be 70-75°C)
5. If any equipment has issues, alert maintenance

Handle errors gracefully - some tools may fail temporarily. 
Retry if needed and provide best assessment with available data.`
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  console.log("Starting monitoring loop...\n");

  // Agentic loop with error handling
  let loopCount = 0;
  while (response.stop_reason === "tool_use" && loopCount < 15) {
    loopCount++;
    
    const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
    
    if (toolUseBlocks.length === 0) break;

    // Process all tool calls with retry logic
    const toolResults = [];
    for (const toolUseBlock of toolUseBlocks) {
      console.log(`\n🔧 Loop ${loopCount}: Tool: ${toolUseBlock.name}`);
      console.log(`   Input: ${JSON.stringify(toolUseBlock.input)}`);

      const toolResult = await callToolWithRetry(
        toolUseBlock.name, 
        toolUseBlock.input,
        3 // max retries
      );

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUseBlock.id,
        content: toolResult
      });
    }

    // Continue conversation
    messages.push({
      role: "assistant",
      content: response.content
    });

    messages.push({
      role: "user",
      content: toolResults
    });

    response = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 4096,
      tools: tools,
      messages: messages
    });
  }

  // Final response
  const finalResponse = response.content.find(block => block.type === "text");
  console.log("\n\n📊 Equipment Monitoring Report:");
  console.log(finalResponse.text);
  console.log("\n✅ Monitoring completed!");
}

runAgent().catch(console.error);
