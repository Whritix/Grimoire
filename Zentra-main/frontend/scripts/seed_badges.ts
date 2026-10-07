/**
 * Badge seeding script for development
 * Creates sample badges and stores them in cache
 * 
 * Usage: pnpm tsx scripts/seed_badges.ts
 */

import { signBadge, generateBadgeId } from '../lib/server/signer';
import { cacheSet } from '../lib/server/cache';

async function seedBadges() {
    console.log('🎖️  Seeding sample badges...\n');

    const sampleBadges = [
        { userId: 'user_001', achievement: 'First Lesson Completed', module: 'JavaScript Fundamentals' },
        { userId: 'user_001', achievement: 'Module Master', module: 'React Essentials' },
        { userId: 'user_002', achievement: 'Perfect Score', assessment: 'JavaScript Quiz' },
        { userId: 'user_002', achievement: 'Week Streak', days: 7 },
        { userId: 'user_003', achievement: 'Early Adopter', timestamp: new Date().toISOString() },
    ];

    for (const badge of sampleBadges) {
        const badgeId = generateBadgeId();
        const badgePayload = {
            badgeId,
            ...badge,
            timestamp: badge.timestamp || new Date().toISOString(),
        };

        const signature = signBadge(badgePayload);

        // Store in cache
        await cacheSet(`badge:${badgeId}`, badgePayload, 86400 * 365); // 1 year

        console.log(`✅ Created badge: ${badgeId}`);
        console.log(`   Achievement: ${badge.achievement}`);
        console.log(`   User: ${badge.userId}`);
        console.log(`   Signature: ${signature.substring(0, 20)}...`);
        console.log('');
    }

    console.log(`✨ Seeded ${sampleBadges.length} badges successfully!\n`);
    process.exit(0);
}

seedBadges().catch((err) => {
    console.error('❌ Error seeding badges:', err);
    process.exit(1);
});
