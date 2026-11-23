import 'dotenv/config';
import { Pool, types } from 'pg';
types.setTypeParser(1114, (value) => value);
if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
export default pool;
