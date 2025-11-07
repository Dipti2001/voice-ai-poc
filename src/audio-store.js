import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AudioStore {
  constructor() {
    this.audioDir = path.join(__dirname, '..', 'public', 'audio');
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  async saveAudio(audioBuffer) {
    const filename = `${uuidv4()}.mp3`;
    const filePath = path.join(this.audioDir, filename);
    await fs.promises.writeFile(filePath, audioBuffer);
    return `/audio/${filename}`; // Returns the URL path
  }

  cleanup() {
    // Cleanup old files (older than 1 hour)
    const files = fs.readdirSync(this.audioDir);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(this.audioDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) { // 1 hour
        fs.unlinkSync(filePath);
      }
    });
  }
}

export const audioStore = new AudioStore();