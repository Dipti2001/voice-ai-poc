import Database from 'sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

/**
 * Tenant-specific database with isolation
 */
class TenantDatabase {
  constructor(tenantId, options = {}) {
    this.tenantId = tenantId;
    this.options = options;
    this.dbPath = this._getDatabasePath();
    this.db = null;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize() {
    try {
      // Ensure database directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      
      // Create database connection
      this.db = await this._createConnection();
      
      // Initialize schema
      await this._initializeSchema();
      
      console.log(`Database initialized for tenant ${this.tenantId}`);
    } catch (error) {
      console.error(`Error initializing database for tenant ${this.tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new agent
   * @param {Object} agentData - Agent data
   * @returns {Promise<Object>} Created agent
   */
  async createAgent(agentData) {
    const {
      id,
      name,
      prompt,
      type = 'sales',
      useCase = 'both',
      phoneNumber,
      voice = 'aura-asteria-en'
    } = agentData;

    const query = `
      INSERT INTO agents 
      (id, tenant_id, name, prompt, type, use_case, phone_number, voice, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await this._run(query, [
      id,
      this.tenantId,
      name,
      prompt,
      type,
      useCase,
      phoneNumber,
      voice
    ]);

    return { id, tenantId: this.tenantId, ...agentData };
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation data
   */
  async getConversation(conversationId) {
    const query = 'SELECT * FROM conversations WHERE id = ? AND tenant_id = ?';
    const row = await this._get(query, [conversationId, this.tenantId]);
    
    if (row && row.agent_config) {
      row.agentConfig = JSON.parse(row.agent_config);
    }
    
    return row;
  }

  /**
   * Update conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated conversation
   */
  async updateConversation(conversationId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const query = `
      UPDATE conversations 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND tenant_id = ?
    `;

    await this._run(query, [...values, conversationId, this.tenantId]);
    return await this.getConversation(conversationId);
  }

  /**
   * Add message to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} role - Message role (user/assistant)
   * @param {string} content - Message content
   * @returns {Promise<Object>} Created message
   */
  async addMessage(conversationId, role, content) {
    const messageId = uuidv4();
    const query = `
      INSERT INTO conversation_messages 
      (id, conversation_id, role, content, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await this._run(query, [messageId, conversationId, role, content]);
    
    return {
      id: messageId,
      conversationId,
      role,
      content,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get messages for conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Array of messages
   */
  async getMessages(conversationId) {
    const query = `
      SELECT * FROM conversation_messages 
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `;
    
    return await this._all(query, [conversationId]);
  }

  /**
   * Create callback request
   * @param {Object} requestData - Callback request data
   * @returns {Promise<Object>} Created callback request
   */
  async createCallbackRequest(requestData) {
    const id = uuidv4();
    const {
      conversationId,
      tenantId,
      reason = 'Human transfer requested',
      status = 'pending',
      notes = null
    } = requestData;

    const query = `
      INSERT INTO callback_requests
      (id, conversation_id, tenant_id, reason, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await this._run(query, [id, conversationId, tenantId, reason, status, notes]);
    
    return { id, ...requestData };
  }

  /**
   * Get analytics for tenant
   * @param {Object} filters - Analytics filters
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalytics(filters = {}) {
    const baseQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN rating >= 7 THEN 1 END) as successful_calls,
        AVG(rating) as avg_rating,
        AVG(duration) as avg_duration,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_calls,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_calls
      FROM conversations 
      WHERE tenant_id = ?
    `;

    let query = baseQuery;
    const params = [this.tenantId];

    // Add date filters if provided
    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    const analytics = await this._get(query, params);
    
    // Get top categories
    const categoryQuery = `
      SELECT JSON_EXTRACT(analysis, '$.categories') as categories, COUNT(*) as count
      FROM conversations 
      WHERE tenant_id = ? AND analysis IS NOT NULL
      GROUP BY categories
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const categories = await this._all(categoryQuery, [this.tenantId]);
    
    return {
      ...analytics,
      categories: categories.map(row => ({
        category: row.categories,
        count: row.count
      }))
    };
  }

  /**
   * Health check for database connection
   * @returns {Promise<boolean>} Database health status
   */
  async healthCheck() {
    try {
      await this._get('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  // Private methods
  _getDatabasePath() {
    const dbDir = this.options.dbPath || path.join(process.cwd(), 'tenant-databases');
    return path.join(dbDir, `${this.tenantId}.db`);
  }

  async _createConnection() {
    return new Promise((resolve, reject) => {
      const db = new Database.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  async _initializeSchema() {
    const tables = [
      {
        name: 'conversations',
        schema: `
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            call_sid TEXT,
            direction TEXT CHECK(direction IN ('inbound', 'outbound')) NOT NULL,
            customer_number TEXT NOT NULL,
            agent_config TEXT NOT NULL,
            status TEXT DEFAULT 'initiated',
            transcription TEXT, -- JSON array of conversation messages: [{role, content, timestamp}, ...]
            audio_url TEXT,
            recording_url TEXT,
            rating INTEGER CHECK(rating >= 1 AND rating <= 10),
            analysis TEXT,
            success BOOLEAN DEFAULT 0,
            duration INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
          )
        `
      },
      {
        name: 'conversation_messages',
        schema: `
          CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
          )
        `
      },
      {
        name: 'callback_requests',
        schema: `
          CREATE TABLE IF NOT EXISTS callback_requests (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            reason TEXT DEFAULT 'Human transfer requested',
            preferred_time DATETIME,
            status TEXT CHECK(status IN ('pending', 'scheduled', 'completed', 'cancelled')) DEFAULT 'pending',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
          )
        `
      }
    ];

    for (const table of tables) {
      await this._run(table.schema);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_callback_requests_tenant_id ON callback_requests(tenant_id)'
    ];

    for (const index of indexes) {
      await this._run(index);
    }
  }

  async _run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async _get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async _all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

export { TenantDatabase };