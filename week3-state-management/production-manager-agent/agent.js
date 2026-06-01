require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// State Management
class StateManager {
  constructor(filename = "state.json") {
    this.filename = filename;
    this.loadState();
  }

  loadState() {
    try {
      const data = fs.readFileSync(this.filename, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error) {
      console.log("Creating new state file...");
      this.state = this.getDefaultState();
      this.saveState();
    }
  }

  getDefaultState() {
    return {
      session_id: `prod_${Date.now()}`,
      batches: [],
      quality_history: [],
      settings: {
        target_quality: 8.5,
        min_batch_size: 50,
        max_batch_size: 200
      },
      statistics: {
        total_batches: 0,
        average_quality: 0,
        successful_batches: 0
      }
    };
  }

  saveState() {
    fs.writeFileSync(this.filename, JSON.stringify(this.state, null, 2));
  }

  addBatch(batch_data) {
    this.state.batches.push({
      id: this.state.batches.length + 1,
      timestamp: new Date().toISOString(),
      ...batch_data
    });
    this.updateStatistics();
    this.saveState();
  }

  updateStatistics() {
    const batches = this.state.batches;
    if (batches.length === 0) return;

    this.state.statistics.total_batches = batches.length;
    this.state.statistics.successful_batches = batches.filter(b => b.quality >= 8.0).length;
    
    const qualities = batches.map(b => b.quality || 0);
    this.state.statistics.average_quality = (
      qualities.reduce((a, b) => a + b, 0) / qualities.length
    ).toFixed(2);
  }

  getContext() {
    return {
      total_batches_produced: this.state.statistics.total_batches,
      average_quality: this.state.statistics.average_quality,
      success_rate: (
        (this.state.statistics.successful_batches / Math.max(1, this.state.statistics.total_batches)) * 100
      ).toFixed(1),
      recent_batches: this.state.batches.slice(-3),
      target_quality: this.state.settings.target_quality,
      session_duration_minutes: this.getSessionDuration()
    };
  }

  getSessionDuration() {
    if (this.state.batches.length === 0) return 0;
    const first = new Date(this.state.batches[0].timestamp);
    const last = new Date(this.state.batches[this.state.batches.length - 1].timestamp);
    return Math.round((last - first) / 60000);
  }
}

const tools = [
  {
    name: "record_batch",
    description: "Record a completed batch with quality metrics",
    input_schema: {
      type: "object",
      properties: {
        batch_name: { type: "string" },
        liters_produced: { type: "number" },
        quality_score: { type: "number" },
        notes: { type: "string" }
      },
      required: ["batch_name", "liters_produced", "quality_score"]
    }
  },
  {
    name: "analyze_trends",
    description: "Analyze production trends",
    input_schema: {
      type: "object",
      properties: {
        analysis_type: {
          type: "string",
          enum: ["quality_trend", "volume_trend", "success_rate"]
        }
      },
      required: ["analysis_type"]
    }
  },
  {
    name: "get_production_summary",
    description: "Get production summary",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "recommend_adjustments",
    description: "Recommend adjustments",
    input_schema: {
      type: "object",
      properties: {
        adjustment_focus: {
          type: "string",
          enum: ["quality", "consistency", "efficiency"]
        }
      },
      required: ["adjustment_focus"]
    }
  },
  {
    name: "get_state_context",
    description: "Get current state",
    input_schema: { type: "object", properties: {} }
  }
];

function processToolCall(toolName, toolInput, stateManager) {
  try {
    switch (toolName) {
      case "record_batch":
        stateManager.addBatch({
          batch_name: toolInput.batch_name,
          liters_produced: toolInput.liters_produced,
          quality: toolInput.quality_score,
          notes: toolInput.notes || ""
        });
        return JSON.stringify({
          status: "success",
          message: `Batch recorded`,
          new_total: stateManager.state.statistics.total_batches,
          average_quality: stateManager.state.statistics.average_quality
        });

      case "analyze_trends":
        const batches = stateManager.state.batches;
        if (batches.length < 2) {
          return JSON.stringify({ message: "Not enough data" });
        }
        if (toolInput.analysis_type === "quality_trend") {
          const qualities = batches.map(b => b.quality);
          return JSON.stringify({
            first: qualities[0],
            latest: qualities[qualities.length - 1],
            trend: qualities[qualities.length - 1] > qualities[0] ? "improving" : "declining"
          });
        }
        return JSON.stringify({ analyzed: true });

      case "get_production_summary":
        return JSON.stringify(stateManager.getContext());

      case "recommend_adjustments":
        return JSON.stringify({
          focus: toolInput.adjustment_focus,
          recommendations: ["Adjust 1", "Adjust 2", "Adjust 3"]
        });

      case "get_state_context":
        return JSON.stringify(stateManager.getContext());

      default:
        throw new Error("Unknown tool");
    }
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

async function runProductionSession() {
  const stateManager = new StateManager("state.json");
  console.log("🤖 Production Manager Started...\n");

  const messages = [
    {
      role: "user",
      content: `Record 3 batches then analyze trends:
1. CB_101: 150L, quality 8.2
2. CB_102: 160L, quality 8.8
3. CB_103: 155L, quality 7.9

Then provide recommendations.`
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  let loopCount = 0;
  while (response.stop_reason === "tool_use" && loopCount < 20) {
    loopCount++;
    const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
    if (toolUseBlocks.length === 0) break;

    const toolResults = [];
    for (const toolUseBlock of toolUseBlocks) {
      console.log(`💾 Step ${loopCount}: ${toolUseBlock.name}`);
      const toolResult = processToolCall(toolUseBlock.name, toolUseBlock.input, stateManager);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUseBlock.id,
        content: toolResult
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

  const finalResponse = response.content.find(block => block.type === "text");
  console.log("\n📊 Summary:");
  console.log(finalResponse.text);
  console.log("\n✅ Done!");
}

runProductionSession().catch(console.error);
