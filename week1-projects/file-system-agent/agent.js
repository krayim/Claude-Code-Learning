require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tools for file operations
const tools = [
  {
    name: "read_file",
    description: "Read contents of a file",
    input_schema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Path to the file to read"
        }
      },
      required: ["filepath"]
    }
  },
  {
    name: "list_directory",
    description: "List files in a directory",
    input_schema: {
      type: "object",
      properties: {
        dirpath: {
          type: "string",
          description: "Path to the directory"
        }
      },
      required: ["dirpath"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file",
    input_schema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Path to the file"
        },
        content: {
          type: "string",
          description: "Content to write"
        }
      },
      required: ["filepath", "content"]
    }
  }
];

// Tool implementations
function processToolCall(toolName, toolInput) {
  try {
    switch (toolName) {
      case "read_file":
        return fs.readFileSync(toolInput.filepath, 'utf-8');
      case "list_directory":
        return fs.readdirSync(toolInput.dirpath).join('\n');
      case "write_file":
        fs.writeFileSync(toolInput.filepath, toolInput.content);
        return `File written successfully: ${toolInput.filepath}`;
      default:
        return "Unknown tool";
    }
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function runAgent() {
  console.log("🤖 File System Agent Started...\n");

  const messages = [
    {
      role: "user",
      content: "List files in the current directory, then create a file called 'notes.txt' with the content 'Week 1 Learning Progress'"
    }
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-1",
    max_tokens: 4096,
    tools: tools,
    messages: messages
  });

  console.log("Initial response:", response.content);

  // Agentic loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find(block => block.type === "tool_use");
    
    if (!toolUseBlock) break;

    console.log(`\n🔧 Using tool: ${toolUseBlock.name}`);
    console.log(`   Input: ${JSON.stringify(toolUseBlock.input)}`);

    const toolResult = processToolCall(toolUseBlock.name, toolUseBlock.input);
    console.log(`   Result: ${toolResult}`);

    // Continue conversation
    messages.push({
      role: "assistant",
      content: response.content
    });

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult
        }
      ]
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
  console.log("\n📤 Final Response:");
  console.log(finalResponse.text);
  console.log("\n✅ Agent completed!");
}

runAgent().catch(console.error);
