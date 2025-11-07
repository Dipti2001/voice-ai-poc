import Database from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'voice_ai.db');

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new Database.Database(DB_PATH);

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          prompt TEXT NOT NULL,
          type TEXT DEFAULT 'sales',
          use_case TEXT CHECK(use_case IN ('inbound', 'outbound', 'both')) DEFAULT 'both',
          phone_number TEXT,
          voice TEXT DEFAULT 'aura-asteria-en',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone_number TEXT NOT NULL UNIQUE,
          email TEXT,
          company TEXT,
          notes TEXT,
          tags TEXT,
          last_called DATETIME,
          call_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          call_sid TEXT,
          direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
          customer_number TEXT NOT NULL,
          transcription TEXT,
          audio_url TEXT,
          recording_url TEXT,
          rating INTEGER CHECK(rating >= 1 AND rating <= 10),
          analysis TEXT,
          success BOOLEAN DEFAULT 0,
          duration INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agent_id) REFERENCES agents (id)
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        );
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);`);

      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
}

initializeDatabase().catch(console.error);