import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getEnv(key) {
    try {
        const envPath = path.join(rootDir, '.env');
        if (!fs.existsSync(envPath)) return null;
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

const API_KEY = getEnv('VITE_GEMINI_API_KEY');

if (!API_KEY) {
    console.error("No API Key found");
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        console.log("VERIFIED_MODELS_START");
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(m.name.split('/').pop());
                }
            });
        }
        console.log("VERIFIED_MODELS_END");
    } catch (error) {
        console.error("Error:", error.message);
    }
}

listModels();
