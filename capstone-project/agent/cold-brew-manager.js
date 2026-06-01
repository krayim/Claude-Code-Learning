require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

class StateManager {
  constructor(filename = "production-state.json") {
    this.filename = filename;
    this.loadState();
  }

  loadState() {
    try {
      const data = fs.readFileSync(this.filename, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error) {
      this.state = {
        session_id: `capstone_${Date.now()}`,
        batches: [],
        statistics: { total: 0, avg_quality: 0, success_rate: 0 }
      };
      this.saveState();
    }
  }

  saveState() {
    fs.writeFileSync(this.filename, JSON.stringify(this.state, null, 2));
  }

  addBatch(batch) {
    this.state.batches.push({ id: this.state.batches.length + 1, ...batch });
    this.updateStats();
    this.saveState();
  }

  updateStats() {
    const b = this.state.batches;
    this.state.statistics.total = b.length;
    if (b.length > 0) {
      const qualities = b.map(x => x.quality || 0);
      this.state.statistics.avg_quality = (qualities.reduce((a, c) => a + c) / qualities.length).toFixed(2);
      this.state.statistics.success_rate = ((b.filter(x => x.quality >= 8).length / b.length) * 100).toFixed(1);
    }
  }

  getContext() {
    return `Production History:
- Total Batches: ${this.state.statistics.total}
- Average Quality: ${this.state.statistics.avg_quality}/10
- Success Rate: ${this.state.statistics.success_rate}%`;
  }
}

const tools = [
  {
    name: "plan_batch",
    description: "Plan a new Cold Brew batch",
    input_schema: {
      type: "object",
      properties: {
        batch_name: { type: "string" },
        liters: { type: "number" },
        recipe_type: { type: "string", enum: ["standard", "light", "dark"] }
      },
      required: ["batch_name", "liters", "recipe_type"]
    }
  },
  {
    name: "record_production",
    description: "Record completed batch",
    input_schema: {
      type: "object",
      properties: {
        batch_name: { type: "string" },
        quality_score: { type: "number" }
      },
      required: ["batch_name", "quality_score"]
    }
  },
  {
    name: "check_equipment",
    description: "Check temperature from sensors",
    input_schema: {
      type: "object",
      properties: {
        sensor_id: { type: "string" }
      },
      required: ["sensor_id"]
    }
  },
  {
    name: "analyze_trends",
    description: "Analyze production trends",
    input_schema: { type: "object", properties: {} }
  }
];

function processToolCall(name, input, stateManager) {
  try {
    switch (name) {
      case "plan_batch":
        const recipe = {
          standard: { water: 1000, beans: 200, hours: 12 },
          light: { water: 1000, beans: 150, hours: 16 },
          dark: { water: 1000, beans: 250, hours: 10 }
        }[input.recipe_type];
        return JSON.stringify({
          status: "planned",
          batch: input.batch_name,
          ingredients: recipe,
          estimated_yield: input.liters
        });

      case "record_production":
        stateManager.addBatch({
          name: input.batch_name,
          quality: input.quality_score,
          timestamp: new Date().toISOString()
        });
        return JSON.stringify({
          status: "recorded",
          batch: input.batch_name,
          quality: input.quality_score
        });

      case "check_equipment":
        const temps = { fermenter_1: 22.5, fermenter_2: 23.1, pasteurizer: 72.5 };
        return JSON.stringify({
          sensor: input.sensor_id,
          temperature: temps[input.sensor_id] || 20,
          status: "operational"
        });

      case "analyze_trends":
        return JSON.stringify({ trends: stateManager.getContext() });

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

async function runCapstone() {
  const stateManager = new StateManager("production-state.json");

  console.log("🏭 Cold Brew Production Management System Started\n");
  console.log(stateManager.getContext());

  const messages = [
    {
      role: "user",
      content: `You are the Cold Brew Production Manager AI.

Today's tasks:
1. Check production history
2. Plan 3 new batches (standard, light, dark)
3. Record quality scores: 8.5, 8.2, 8.9
4. Analyze trends
5. Make recommendations

Use history to make intelligent decisions.`
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  console.log("\nStarting workflow...\n");

  let loopCount = 0;
  while (response.stop_reason === "tool_use" && loopCount < 20) {
    loopCount++;
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    if (toolUseBlocks.length === 0) break;

    const toolResults = [];
    for (const block of toolUseBlocks) {
      console.log(`⚙️ Step ${loopCount}: ${block.name}`);
      const result = processToolCall(block.name, block.input, stateManager);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 4096,
      tools: tools,
      messages: messages
    });
  }

  const finalResponse = response.content.find(b => b.type === "text");
  console.log("\n📊 Production Report:");
  console.log(finalResponse.text);
  console.log("\n✅ Done!");
}

runCapstone().catch(console.error);
