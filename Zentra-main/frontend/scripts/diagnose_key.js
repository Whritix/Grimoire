
const fs = require('fs');
const path = require('path');

// Simulate Next.js/dotenv loading or just read the file directly
const envPath = path.resolve(process.cwd(), '../.env');
console.log('Reading .env from:', envPath);

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    // Simple naive parsing to see what's physically in the file
    const match = envContent.match(/FIREBASE_PRIVATE_KEY=(.*)/);
    if (match) {
        const rawValue = match[1];
        console.log('Raw line from file (first 50):', rawValue.substring(0, 50));
        console.log('Starts with quote?', rawValue.startsWith('"'));
        console.log('Ends with quote?', rawValue.endsWith('"'));
    } else {
        console.log('FIREBASE_PRIVATE_KEY not found in file via regex');
    }
} catch (e) {
    console.error('Error reading .env:', e);
}

// Now checking actual process.env if we used dotenv
require('dotenv').config({ path: envPath });
const procKey = process.env.FIREBASE_PRIVATE_KEY;
console.log('process.env.FIREBASE_PRIVATE_KEY type:', typeof procKey);
if (procKey) {
    console.log('process.env Length:', procKey.length);
    console.log('process.env Start (first 50):', procKey.substring(0, 50));
    console.log('ASCII of first 10:', procKey.substring(0, 10).split('').map(c => c.charCodeAt(0)));
    
    // Apply the logic from firebase.ts
    let key = procKey;
    key = key.replace(/\\n/g, '\n');
    if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
    }
    
    console.log('Processed Key Start (first 50):', key.substring(0, 50));
    console.log('Processed Key ASCII (first 10):', key.substring(0, 10).split('').map(c => c.charCodeAt(0)));
    
    // Ensure trailing newline (critical for some OpenSSL versions)
    if (!key.endsWith('\n')) {
        key += '\n';
    }

    console.log('Final Key for Init Start:', key.substring(0, 50));
    console.log('Final Key for Init End:', JSON.stringify(key.substring(key.length - 10)));
    
    // Try to initialize Firebase
    try {
        const admin = require('firebase-admin');
        const projectId = process.env.FIREBASE_PROJECT_ID || 'test-project';
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'test@example.com';
        
        console.log('Attempting Firebase Init with:', { projectId, clientEmail });
        
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: key,
            }),
            projectId: projectId,
        });
        console.log('✅✅✅ Firebase Admin Initialized SUCCESSFULLY! ✅✅✅');
        console.log('The key works in this script.');
    } catch (err) {
        console.error('❌❌❌ Firebase Init FAILED ❌❌❌');
        console.error(err);
    }
}
