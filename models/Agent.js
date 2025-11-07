import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

class Agent {
  static async create(agentData) {
    const id = uuidv4();
    const { name, prompt, type = 'sales', use_case = 'both', phone_number = null, voice = 'aura-asteria-en' } = agentData;

    await db.run(
      `INSERT INTO agents (id, name, prompt, type, use_case, phone_number, voice) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, prompt, type, use_case, phone_number, voice]
    );

    return { 
      id, 
      name, 
      prompt, 
      type, 
      use_case, 
      phone_number, 
      voice 
    };
  }

  static async findById(id) {
    return await db.get('SELECT * FROM agents WHERE id = ?', [id]);
  }

  static async findAll() {
    return await db.all('SELECT * FROM agents ORDER BY created_at DESC');
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await db.run(
      `UPDATE agents SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await db.run('DELETE FROM agents WHERE id = ?', [id]);
    return true;
  }

  static async findByPhoneNumber(phoneNumber) {
    return await db.get('SELECT * FROM agents WHERE phone_number = ?', [phoneNumber]);
  }
}

export default Agent;