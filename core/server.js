#!/usr/bin/env node

import { VoiceAIApiServer } from './core/VoiceAIApiServer.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Multi-Tenant Voice AI Server Entry Point
 */
async function main() {
  try {
    // Create and start the server
    const server = new VoiceAIApiServer({
      port: process.env.PORT || 3000
    });

    await server.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };