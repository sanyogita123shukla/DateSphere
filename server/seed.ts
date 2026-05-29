import { getDb } from './src/db';
import bcrypt from 'bcryptjs';

async function seed() {
    const db = await getDb();
    
    try {
        // Hash a shared demo password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('password123', salt);

        await db.run(`
           INSERT INTO users (username, password, display_name, bio, cultural_id, interests, credits, total_connections) VALUES 
           ('aisha_k', '${hash}', 'Aisha', 'I find magic in Sufi poetry and mountain silence. Looking for someone who values depth over speed — lets trade playlists before small talk. Rumi and chai over Netflix and chill.', 'Kashmiri', 'poetry,music,hiking,spirituality,chai', 5, 3),
           ('david_m', '${hash}', 'David', 'Building apps by day, reading Asimov by night. I believe great conversations are the real algorithm. Looking for intentional connection, not just another match notification.', 'American', 'technology,react,sci-fi,philosophy,coffee', 4, 7),
           ('priya_s', '${hash}', 'Priya', 'Bharatanatyam dancer turned software engineer. I code in TypeScript and express in mudras. Seeking someone who appreciates structure and spontaneity equally.', 'Punjabi', 'dance,coding,food,yoga,art', 5, 2),
           ('carlos_r', '${hash}', 'Carlos', 'Chasing golden hour across continents with my camera. I believe the best connections happen when you stop scrolling and start listening. Deep conversations welcome.', 'Latino', 'photography,travel,conversations,coffee,sunsets', 3, 5),
           ('yuki_t', '${hash}', 'Yuki', 'I craft sushi with the same precision I speedrun retro games. Rainy days, lo-fi beats, and someone who gets excited about obscure anime — thats my vibe.', 'Japanese', 'anime,cooking,gaming,music,rain', 5, 1),
           ('fatima_a', '${hash}', 'Fatima', 'Architect by profession, historian by passion. I design spaces that tell stories. Seeking someone who builds meaning, not just connections.', 'Turkish', 'architecture,history,coffee,design,books', 2, 9),
           ('liam_w', '${hash}', 'Liam', 'Marine biologist who DJ-s on weekends. I study coral reefs and mix deep house. Looking for someone who rides waves — literal or metaphorical.', 'Australian', 'surfing,marine-biology,music,ocean,sustainability', 5, 4),
           ('jin_p', '${hash}', 'Jin', 'Choreographer, bubble tea scientist, and unapologetic K-pop stan. I believe rhythm reveals character. Show me your playlist and I will show you mine.', 'Korean', 'kpop,dance,tea,fashion,creativity', 4, 6)
        `);
        console.log('✓ Seeding complete — 8 demo profiles created');
        console.log('  Default login: any username above / password123');
    } catch(e: any) {
        if (e.message?.includes('UNIQUE constraint')) {
            console.log('ℹ Seed data already exists, skipping.');
        } else {
            console.error('✗ Seed error:', e.message);
        }
    }
}

seed();
