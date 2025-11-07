import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

class Conversation {
  static async create(conversationData) {
    const id = uuidv4();
    const {
      agent_id,
      call_sid,
      direction,
      customer_number,
      transcription = null,
      audio_url = null,
      recording_url = null,
      rating = null,
      analysis = null,
      success = false,
      duration = null
    } = conversationData;

    await db.run(`
      INSERT INTO conversations
      (id, agent_id, call_sid, direction, customer_number, transcription, audio_url, recording_url, rating, analysis, success, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, agent_id, call_sid, direction, customer_number, transcription, audio_url, recording_url, rating, analysis, success, duration]
    );

    return { id, ...conversationData };
  }

  static async findById(id) {
    return await db.get('SELECT * FROM conversations WHERE id = ?', [id]);
  }

  static async findByAgentId(agentId, limit = 50) {
    return await db.all(
      'SELECT * FROM conversations WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
      [agentId, limit]
    );
  }

  static async findAll(limit = 100) {
    return await db.all(
      'SELECT c.*, a.name as agent_name FROM conversations c JOIN agents a ON c.agent_id = a.id ORDER BY c.created_at DESC LIMIT ?',
      [limit]
    );
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await db.run(
      `UPDATE conversations SET ${setClause} WHERE id = ?`,
      [...values, id]
    );

    return await this.findById(id);
  }

  static async addMessage(conversationId, role, content) {
    const id = uuidv4();
    await db.run(
      'INSERT INTO conversation_messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
      [id, conversationId, role, content]
    );
    return { id, conversation_id: conversationId, role, content };
  }

  static async getMessages(conversationId) {
    return await db.all(
      'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );
  }

  static async getAnalytics(agentId = null) {
    let query = `
      SELECT
        COUNT(*) as total_calls,
        AVG(rating) as avg_rating,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
        AVG(duration) as avg_duration
      FROM conversations
    `;
    const params = [];

    if (agentId) {
      query += ' WHERE agent_id = ?';
      params.push(agentId);
    }

    return await db.get(query, params);
  }

  static async findByCallSid(callSid) {
    return await db.get('SELECT * FROM conversations WHERE call_sid = ?', [callSid]);
  }
}

export default Conversation;