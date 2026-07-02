import { db } from './src/lib/db';
import { users } from './src/lib/schema';

async function testConnection() {
  try {
    const result = await db.select().from(users).limit(1);
    console.log('Connection successful:', result);
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();