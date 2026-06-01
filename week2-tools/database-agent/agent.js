require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mock database
const database = {
  production_logs: [
    { id: 1, date: "2026-05-30", batch: "CB001", liters: 50, quality: 9.2 },
    { id: 2, date: "2026-05-31", batch: "CB002", liters: 48, quality: 8.9 },
  ],
  inventory: [
    { item: "coffee_beans", quantity: 200, unit: "kg", min_level: 50 },
    { item: "bottles", quantity: 500, unit: "units", min_level: 100 },
    { item: "filters", quantity: 1000, unit: "units", min_level: 200 },
  ],
  equipment_status: [
    { equipment: "fermenter_1", status: "operational", temperature: 22.5 },
    { equipment: "fermenter_2", status: "operational", temperature: 23.1 },
    { equipment: "bottler", status: "maintenance", estimated_ready: "2026-06-02" },
  ]
};

// Tools
const tools = [
  {
    name: "query_production_logs",
    description: "Query production logs for Cold Brew batches",
    input_schema: {
      type: "object",
      properties: {
        filter_date: {
          type: "string",
          description: "Filter by date (YYYY-MM-DD) or 'latest'"
        }
      },
      required: ["filter_date"]
    }
  },
  {
    name: "check_inventory",
    description: "Check current inventory levels",
    input_schema: {
      type: "object",
      properties: {
        item: {
          type: "string",
          description: "Item name to check (or 'all' for all items)"
        }
      },
      required: ["item"]
    }
  },
  {
    name: "get_equipment_status",
    description: "Get equipment operational status",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "generate_report",
    description: "Generate a production summary report",
    input_schema: {
      type: "object",
      properties: {
        report_type: {
          type: "string",
          enum: ["daily", "inventory", "equipment"],
          description: "Type of report to generate"
        }
      },
      required: ["report_type"]
    }
  }
];

// Tool implementations
function processToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case "query_production_logs":
        if (toolInput.filter_date === "latest") {
          return JSON.stringify(database.production_logs[database.production_logs.length - 1]);
        }
        const filtered = database.production_logs.filter(log => log.date === toolInput.filter_date);
        return filtered.length > 0 ? JSON.stringify(filtered) : "No logs found for this date";
      
      case "check_inventory":
        if (toolInput.item === "all") {
          return JSON.stringify(database.inventory);
        }
        const item = database.inventory.find(i => i.item === toolInput.item);
        return item ? JSON.stringify(item) : `Item '${toolInput.item}' not found`;
      
      case "get_equipment_status":
        return JSON.stringify(database.equipment_status);
      
      case "generate_report":
        const reportType = toolInput.report_type;
        if (reportType === "daily") {
          const latest = database.production_logs[database.production_logs.length - 1];
          return `Daily Report:\nLatest batch ${latest.batch}: ${latest.liters}L, Quality: ${latest.quality}/10`;
        } else if (reportType === "inventory") {
          const low = database.inventory.filter(i => i.quantity <= i.min_level);
          return `Inventory Alert: ${low.length} items below minimum level\n${JSON.stringify(low)}`;
        } else {
          const down = database.equipment_status.filter(e => e.status !== "operational");
          return `Equipment Report:\nOperational: ${database.equipment_status.filter(e => e.status === "operational").length}\nMaintenance: ${down.length}`;
        }
      
      default:
        return "Unknown tool";
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function runAgent() {
  console.log("🤖 Cold Brew Production Agent Started...\n");

  const messages = [
    {
      role: "user",
      content: `You are a Cold Brew Coffee production manager. 
      
Please:
1. Check the latest production log
2. Check inventory levels for coffee_beans and bottles
3. Get equipment status
4. Generate a daily report
5. Summarize findings and recommend any actions`
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  console.log("Starting agentic loop...\n");

  // Agentic loop
  let loopCount = 0;
  while (response.stop_reason === "tool_use" && loopCount < 10) {
    loopCount++;
    
    const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
    
    if (toolUseBlocks.length === 0) break;

    // Process all tool calls
    const toolResults = [];
    for (const toolUseBlock of toolUseBlocks) {
      console.log(`\n🔧 Iteration ${loopCount}: Tool: ${toolUseBlock.name}`);
      console.log(`   Input: ${JSON.stringify(toolUseBlock.input)}`);

      const toolResult = processToolCall(toolUseBlock.name, toolUseBlock.input);
      console.log(`   Result: ${toolResult.substring(0, 100)}...`);

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
  console.log("\n\n📤 Final Analysis:");
  console.log(finalResponse.text);
  console.log("\n✅ Agent completed!");
}

runAgent().catch(console.error);
