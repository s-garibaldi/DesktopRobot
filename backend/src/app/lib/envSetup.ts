import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root
// Next.js also automatically loads .env files, but this ensures it's loaded early
dotenv.config({ path: path.resolve(process.cwd(), '.env') });