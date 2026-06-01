const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

class TemperatureSensorMCP {
  constructor() {
    this.sensors = {
      fermenter_1: { current_temp: 22.5, min: 20, max: 25, status: 'operational' },
      fermenter_2: { current_temp: 23.1, min: 20, max: 25, status: 'operational' },
      pasteurizer: { current_temp: 72.5, min: 70, max: 75, status: 'operational' },
      dbd_chamber: { current_temp: 18.2, min: 15, max: 35, status: 'operational' }
    };
    
    this.server = new Server({
      name: 'temperature-sensor-mcp',
      version: '1.0.0',
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(
      { method: 'tools/list' },
      async () => ({
        tools: [
          {
            name: 'read_temperature',
            description: 'Read current temperature from a sensor',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_id: { type: 'string', description: 'Sensor ID' }
              },
              required: ['sensor_id']
            }
          },
          {
            name: 'get_all_sensors',
            description: 'Get all sensor status',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'check_temperature_range',
            description: 'Check if sensor is in safe range',
            inputSchema: {
              type: 'object',
              properties: { sensor_id: { type: 'string' } },
              required: ['sensor_id']
            }
          }
        ]
      })
    );

    this.server.setRequestHandler(
      { method: 'tools/call' },
      async (request) => {
        const { name, arguments: args } = request.params;
        let result;

        switch (name) {
          case 'read_temperature':
            result = this.readTemperature(args.sensor_id);
            break;
          case 'get_all_sensors':
            result = this.getAllSensors();
            break;
          case 'check_temperature_range':
            result = this.checkTemperatureRange(args.sensor_id);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
    );
  }

  readTemperature(sensorId) {
    const sensor = this.sensors[sensorId];
    if (!sensor) throw new Error(`Sensor ${sensorId} not found`);
    return {
      sensor_id: sensorId,
      temperature_celsius: sensor.current_temp,
      status: sensor.status,
      timestamp: new Date().toISOString()
    };
  }

  getAllSensors() {
    const result = {};
    for (const [id, data] of Object.entries(this.sensors)) {
      result[id] = {
        temperature: data.current_temp,
        range: [data.min, data.max],
        safe: data.current_temp >= data.min && data.current_temp <= data.max
      };
    }
    return result;
  }

  checkTemperatureRange(sensorId) {
    const sensor = this.sensors[sensorId];
    if (!sensor) throw new Error(`Sensor ${sensorId} not found`);
    const safe = sensor.current_temp >= sensor.min && sensor.current_temp <= sensor.max;
    return {
      sensor: sensorId,
      temperature: sensor.current_temp,
      range: [sensor.min, sensor.max],
      safe: safe,
      alert: safe ? 'OK' : 'WARNING: Out of range!'
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🚀 MCP Server started');
  }
}

const mcp = new TemperatureSensorMCP();
mcp.start().catch(console.error);
