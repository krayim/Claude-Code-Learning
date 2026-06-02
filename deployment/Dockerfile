FROM node:20-alpine

WORKDIR /app

# Install base dependencies
RUN apk add --no-cache git

# Copy agent
COPY capstone-project/agent ./agent
COPY capstone-project/mcp-server ./mcp-server

# Install dependencies
WORKDIR /app/agent
RUN npm install --production

WORKDIR /app/mcp-server
RUN npm install --production

# Set environment
ENV NODE_ENV=production

# Expose port for MCP
EXPOSE 3001

# Default: run agent
WORKDIR /app/agent
CMD ["node", "cold-brew-manager.js"]
