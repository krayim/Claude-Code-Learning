# Equipment Monitor Agent

## Features
- Retry logic for failed API calls
- Error handling with graceful degradation
- Fallback results when all retries exhausted
- Equipment validation before operations
- Maintenance alerting

## How It Works
1. Monitors Cold Brew equipment (fermenters, bottler, pasteurizer)
2. Validates temperature ranges
3. Checks equipment status
4. Sends maintenance alerts when needed
5. Handles network failures with exponential backoff

## Error Scenarios Handled
- Network timeouts
- Unavailable equipment
- Temperature sensor failures
- Invalid equipment IDs

