require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function runAgent() {
  console.log("🤖 Starting Claude Code Agent...\n");

  const systemPrompt = `You are a helpful AI assistant that can:
1. Answer questions
2. Perform calculations
3. Provide guidance

Be concise and helpful.`;

  const userMessage = "Calculate the total power consumption if I have: 3 resistors of 10Ω, 15Ω, 20Ω in series with 12V supply. Then tell me the current.";

  const response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  console.log("📤 User:", userMessage);
  console.log("\n🤖 Agent Response:");
  console.log(response.content[0].text);
  console.log("\n✅ Agent completed!");
}

runAgent().catch(console.error);
