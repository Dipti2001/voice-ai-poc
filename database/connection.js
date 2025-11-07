import Database from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'database', 'voice_ai.db');

class DatabaseConnection {
  constructor() {
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      this.db = new Database.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(this.db);
        }
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close(() => {
          this.db = null;
          resolve();
        });
      });
    }
  }

  async run(sql, params = []) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

const dbInstance = new DatabaseConnection();
export default dbInstance;