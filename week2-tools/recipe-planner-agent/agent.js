require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Database
const database = {
  recipes: {
    standard_cold_brew: { water: 1000, coffee_beans: 200, steep_hours: 12, yield: 800 },
    light_roast: { water: 1000, coffee_beans: 150, steep_hours: 16, yield: 800 },
    dark_roast: { water: 1000, coffee_beans: 250, steep_hours: 10, yield: 800 }
  },
  inventory: {
    coffee_beans: { quantity: 500, unit: "kg", cost_per_unit: 10 },
    water: { quantity: 5000, unit: "L", cost_per_unit: 0.1 },
    bottles: { quantity: 1000, unit: "units", cost_per_unit: 0.50 },
    filters: { quantity: 2000, unit: "units", cost_per_unit: 0.05 },
    labels: { quantity: 1500, unit: "units", cost_per_unit: 0.10 }
  },
  quality_metrics: {
    coffee_beans_impact: 0.4,    // 40% quality from beans
    water_purity_impact: 0.2,    // 20% quality from water
    steep_time_impact: 0.3,      // 30% quality from steeping
    equipment_impact: 0.1        // 10% quality from equipment
  }
};

// Tools
const tools = [
  {
    name: "plan_recipe",
    description: "Create a cold brew recipe based on requirements",
    input_schema: {
      type: "object",
      properties: {
        recipe_type: {
          type: "string",
          enum: ["standard_cold_brew", "light_roast", "dark_roast"],
          description: "Type of cold brew recipe"
        },
        batch_size_liters: {
          type: "number",
          description: "Desired batch size in liters"
        }
      },
      required: ["recipe_type", "batch_size_liters"]
    }
  },
  {
    name: "check_ingredients",
    description: "Check if ingredients are available for the recipe",
    input_schema: {
      type: "object",
      properties: {
        recipe_name: {
          type: "string",
          description: "Recipe name"
        },
        water_needed: {
          type: "number",
          description: "Water needed in liters"
        },
        coffee_beans_needed: {
          type: "number",
          description: "Coffee beans needed in kg"
        }
      },
      required: ["recipe_name", "water_needed", "coffee_beans_needed"]
    }
  },
  {
    name: "calculate_production_cost",
    description: "Calculate total production cost for the batch",
    input_schema: {
      type: "object",
      properties: {
        recipe_name: {
          type: "string",
          description: "Recipe name"
        },
        batch_liters: {
          type: "number",
          description: "Batch size in liters"
        },
        coffee_beans_kg: {
          type: "number",
          description: "Amount of coffee beans in kg"
        },
        water_liters: {
          type: "number",
          description: "Amount of water in liters"
        }
      },
      required: ["recipe_name", "batch_liters", "coffee_beans_kg", "water_liters"]
    }
  },
  {
    name: "estimate_quality_score",
    description: "Estimate expected quality score based on recipe",
    input_schema: {
      type: "object",
      properties: {
        recipe_type: {
          type: "string",
          description: "Type of recipe"
        },
        coffee_beans_used": {
          type: "number",
          description: "Coffee beans used in kg"
        },
        water_quality: {
          type: "string",
          enum: ["standard", "filtered", "premium"],
          description: "Water quality level"
        },
        steep_hours: {
          type: "number",
          description: "Steeping duration in hours"
        }
      },
      required: ["recipe_type", "coffee_beans_used", "water_quality", "steep_hours"]
    }
  },
  {
    name: "suggest_adjustments",
    description: "Suggest recipe adjustments based on constraints",
    input_schema: {
      type: "object",
      properties: {
        constraint: {
          type: "string",
          enum: ["insufficient_ingredients", "high_cost", "low_quality"],
          description: "Type of constraint to address"
        },
        current_recipe: {
          type: "string",
          description: "Current recipe name"
        }
      },
      required: ["constraint", "current_recipe"]
    }
  }
];

// Tool implementations
function processToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case "plan_recipe": {
        const recipe = database.recipes[toolInput.recipe_type];
        const multiplier = toolInput.batch_size_liters / recipe.yield;
        return JSON.stringify({
          recipe_type: toolInput.recipe_type,
          batch_size: toolInput.batch_size_liters,
          ingredients: {
            water: recipe.water * multiplier,
            coffee_beans: recipe.coffee_beans * multiplier,
            steep_time_hours: recipe.steep_hours
          },
          estimated_yield: toolInput.batch_size_liters
        });
      }

      case "check_ingredients": {
        const water_available = database.inventory.water.quantity;
        const beans_available = database.inventory.coffee_beans.quantity;
        
        const water_ok = toolInput.water_needed <= water_available;
        const beans_ok = toolInput.coffee_beans_needed <= beans_available;
        
        return JSON.stringify({
          recipe: toolInput.recipe_name,
          water: {
            needed: toolInput.water_needed,
            available: water_available,
            sufficient: water_ok
          },
          coffee_beans: {
            needed: toolInput.coffee_beans_needed,
            available: beans_available,
            sufficient: beans_ok
          },
          all_ingredients_available: water_ok && beans_ok,
          recommendation: (!water_ok || !beans_ok) ? "Consider adjusting recipe size" : "All ingredients available - proceed"
        });
      }

      case "calculate_production_cost": {
        const bean_cost = toolInput.coffee_beans_kg * database.inventory.coffee_beans.cost_per_unit;
        const water_cost = toolInput.water_liters * database.inventory.water.cost_per_unit;
        const bottle_cost = toolInput.batch_liters * database.inventory.bottles.cost_per_unit;
        const label_cost = toolInput.batch_liters * database.inventory.labels.cost_per_unit;
        const filter_cost = toolInput.batch_liters * 0.20; // per liter filter cost
        
        const total_cost = bean_cost + water_cost + bottle_cost + label_cost + filter_cost;
        const cost_per_liter = total_cost / toolInput.batch_liters;
        
        return JSON.stringify({
          recipe: toolInput.recipe_name,
          batch_size_liters: toolInput.batch_liters,
          cost_breakdown: {
            coffee_beans: bean_cost.toFixed(2),
            water: water_cost.toFixed(2),
            bottles: bottle_cost.toFixed(2),
            labels: label_cost.toFixed(2),
            filters: filter_cost.toFixed(2)
          },
          total_cost: total_cost.toFixed(2),
          cost_per_liter: cost_per_liter.toFixed(2)
        });
      }

      case "estimate_quality_score": {
        let quality = 50; // base score
        
        // Quality adjustments
        if (toolInput.coffee_beans_used > 200) quality += 15; // More beans = better
        if (toolInput.coffee_beans_used < 150) quality -= 10; // Too few beans
        
        if (toolInput.water_quality === "premium") quality += 15;
        if (toolInput.water_quality === "filtered") quality += 8;
        
        if (toolInput.steep_hours >= 12 && toolInput.steep_hours <= 16) quality += 20; // Optimal
        if (toolInput.steep_hours > 16) quality -= 5; // Over-steeped
        
        quality = Math.min(100, Math.max(0, quality)); // Clamp 0-100
        
        return JSON.stringify({
          recipe_type: toolInput.recipe_type,
          estimated_quality_score: quality,
          quality_level: quality >= 85 ? "Premium" : quality >= 70 ? "Good" : quality >= 50 ? "Standard" : "Below Standard",
          factors: {
            coffee_beans_impact: toolInput.coffee_beans_used * 0.05,
            water_quality_contribution: toolInput.water_quality === "premium" ? 15 : 8,
            steeping_optimization: toolInput.steep_hours >= 12 && toolInput.steep_hours <= 16 ? 20 : 0
          }
        });
      }

      case "suggest_adjustments": {
        if (toolInput.constraint === "insufficient_ingredients") {
          return JSON.stringify({
            constraint: toolInput.constraint,
            suggestions: [
              "Reduce batch size by 25%",
              "Switch to light_roast (uses fewer beans)",
              "Order more ingredients before production"
            ],
            recommended_action: "Switch to light_roast recipe"
          });
        } else if (toolInput.constraint === "high_cost") {
          return JSON.stringify({
            constraint: toolInput.constraint,
            suggestions: [
              "Use standard water instead of premium",
              "Reduce batch size",
              "Buy coffee beans in bulk for discount"
            ],
            recommended_action: "Reduce batch size and use standard water"
          });
        } else {
          return JSON.stringify({
            constraint: toolInput.constraint,
            suggestions: [
              "Increase coffee bean ratio",
              "Use premium filtered water",
              "Optimize steeping time (12-16 hours)",
              "Upgrade equipment for better consistency"
            ],
            recommended_action: "Use premium water and optimize steeping"
          });
        }
      }

      default:
        throw new Error("Unknown tool");
    }
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

async function runAgent() {
  console.log("🤖 Recipe Planner Agent (Tool Composition) Started...\n");

  const messages = [
    {
      role: "user",
      content: `You are a Cold Brew Coffee production planner.

Task: Plan a production batch with the following goal:
1. Create a standard_cold_brew recipe for 100 liters
2. Check if ingredients are available
3. Calculate production cost
4. Estimate quality score (use premium filtered water)
5. Based on results, suggest any adjustments needed
6. Provide final recommendation

Use the tools in sequence - the output of one tool should inform what you do with the next tool.`
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  console.log("Starting tool composition chain...\n");

  // Agentic loop with tool chaining
  let loopCount = 0;
  while (response.stop_reason === "tool_use" && loopCount < 20) {
    loopCount++;
    
    const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
    
    if (toolUseBlocks.length === 0) break;

    // Process tools
    const toolResults = [];
    for (const toolUseBlock of toolUseBlocks) {
      console.log(`\n⛓️ Chain Step ${loopCount}: ${toolUseBlock.name}`);
      console.log(`   Input: ${JSON.stringify(toolUseBlock.input)}`);

      const toolResult = processToolCall(toolUseBlock.name, toolUseBlock.input);
      const parsed = JSON.parse(toolResult);
      console.log(`   Result: ${JSON.stringify(parsed, null, 2).split('\n').slice(0, 5).join('\n')}...`);

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
  console.log("\n\n📋 Production Plan & Recommendation:");
  console.log(finalResponse.text);
  console.log("\n✅ Planning completed!");
}

runAgent().catch(console.error);
