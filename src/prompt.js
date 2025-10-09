import fs from 'fs/promises';
import path from 'path';

/**
 * Reads the specified prompt file from the prompts directory and returns
 * its contents as a string.  Prompts allow tenants to customise the
 * behaviour of their AI agents without modifying code.  When adding a new
 * prompt file, place it in the `prompts/` folder at the project root.
 *
 * @param {string} promptName The name of the prompt file (without path).
 * @returns {Promise<string>} The contents of the prompt.
 */
export async function readPrompt(promptName = 'default_prompt.txt') {
  const filePath = path.join(process.cwd(), 'prompts', promptName);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (err) {
    console.error(`Failed to read prompt file ${filePath}:`, err.message);
    throw err;
  }
}