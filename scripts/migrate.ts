import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

console.log('🔄 Running database migrations...');

await migrate(db, { migrationsFolder: 'drizzle' });

console.log('✅ Migrations completed successfully!');

await sql.end();
