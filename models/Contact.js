import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

class Contact {
  static async create(contactData) {
    const id = uuidv4();
    const {
      name,
      phone_number,
      email = null,
      company = null,
      notes = null,
      tags = null
    } = contactData;

    await db.getInstance().run(`
      INSERT INTO contacts (id, name, phone_number, email, company, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone_number, email, company, notes, tags]
    );

    return { id, ...contactData };
  }

  static async findById(id) {
    return await db.getInstance().get('SELECT * FROM contacts WHERE id = ?', [id]);
  }

  static async findAll(limit = 100, search = null) {
    let query = 'SELECT * FROM contacts';
    const params = [];

    if (search) {
      query += ' WHERE name LIKE ? OR phone_number LIKE ? OR company LIKE ? OR email LIKE ?';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await db.getInstance().all(query, params);
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await db.getInstance().run(
      `UPDATE contacts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );

    return await this.findById(id);
  }

  static async delete(id) {
    await db.getInstance().run('DELETE FROM contacts WHERE id = ?', [id]);
    return true;
  }

  static async updateCallStats(id) {
    await db.getInstance().run(
      'UPDATE contacts SET last_called = CURRENT_TIMESTAMP, call_count = call_count + 1 WHERE id = ?',
      [id]
    );
  }

  static async findByPhoneNumber(phoneNumber) {
    return await db.getInstance().get('SELECT * FROM contacts WHERE phone_number = ?', [phoneNumber]);
  }

  static async getCallHistory(limit = 50) {
    return await db.getInstance().all(
      'SELECT * FROM contacts WHERE last_called IS NOT NULL ORDER BY last_called DESC LIMIT ?',
      [limit]
    );
  }
}

export default Contact;