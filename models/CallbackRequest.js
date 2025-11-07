import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

class CallbackRequest {
  static async create(requestData) {
    const id = uuidv4();
    const {
      conversation_id,
      customer_number,
      agent_id,
      reason = 'Human transfer requested',
      preferred_time = null,
      status = 'pending',
      notes = null
    } = requestData;

    await db.run(`
      INSERT INTO callback_requests
      (id, conversation_id, customer_number, agent_id, reason, preferred_time, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, conversation_id, customer_number, agent_id, reason, preferred_time, status, notes]
    );

    return { id, ...requestData };
  }

  static async findById(id) {
    return await db.get('SELECT * FROM callback_requests WHERE id = ?', [id]);
  }

  static async findByAgentId(agentId) {
    return await db.all(
      'SELECT * FROM callback_requests WHERE agent_id = ? ORDER BY created_at DESC',
      [agentId]
    );
  }

  static async findAll(limit = 50) {
    return await db.all(
      'SELECT cr.*, a.name as agent_name FROM callback_requests cr JOIN agents a ON cr.agent_id = a.id ORDER BY cr.created_at DESC LIMIT ?',
      [limit]
    );
  }

  static async updateStatus(id, status, notes = null) {
    await db.run(
      'UPDATE callback_requests SET status = ?, notes = ? WHERE id = ?',
      [status, notes, id]
    );

    return await this.findById(id);
  }

  static async getPendingRequests() {
    return await db.all(
      'SELECT * FROM callback_requests WHERE status = ? ORDER BY created_at ASC',
      ['pending']
    );
  }
}

export default CallbackRequest;