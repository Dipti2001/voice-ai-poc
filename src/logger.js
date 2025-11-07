import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
    this.currentLogFile = path.join(this.logDir, `call-${new Date().toISOString().slice(0,10)}.log`);
  }

  log(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      message,
      data
    };

    const logString = JSON.stringify(logEntry, null, 2);
    console.log(logString); // Console output for immediate visibility

    // Append to log file
    fs.appendFileSync(this.currentLogFile, logString + '\n');
  }

  call(message, data = {}) {
    this.log('CALL', message, data);
  }

  speech(message, data = {}) {
    this.log('SPEECH', message, data);
  }

  llm(message, data = {}) {
    this.log('LLM', message, data);
  }

  error(message, error = {}) {
    this.log('ERROR', message, {
      error: error.message || error,
      stack: error.stack
    });
  }
}

export const logger = new Logger();