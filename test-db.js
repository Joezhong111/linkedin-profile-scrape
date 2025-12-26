import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './db/client.js';
import { linkedinLeads } from './db/schema.js';

async function test() {
    try {
        const rows = await db.select().from(linkedinLeads).limit(5);
        console.log('Success!', rows);
    } catch (err) {
        console.error('Error!', err);
    } finally {
        process.exit();
    }
}

test();
