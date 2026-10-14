import * as admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      // Handle both literal \n characters (from .env) and actual newlines
      privateKey = privateKey.replace(/\\n/g, "\n");
      // If the key is quoted in the env var (common in some setups), strip quotes
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      // Ensure trailing newline (critical for some OpenSSL versions)
      if (!privateKey.endsWith('\n')) {
        privateKey += '\n';
      }
    }

    if (projectId && clientEmail && privateKey) {
      console.log('--- FIREBASE KEY DEBUG ---');
      console.log('Project:', projectId);
      console.log('Email:', clientEmail);
      console.log('Key Length:', privateKey.length);
      console.log('Key Start:', privateKey.substring(0, 50));
      console.log('Key End (json):', JSON.stringify(privateKey.substring(privateKey.length - 10)));
      console.log('Has Real Newline:', privateKey.includes('\n'));
      console.log('Has Literal \\n:', privateKey.includes('\\n'));
      console.log('ASCII first 5:', privateKey.split('').slice(0, 5).map(c => c.charCodeAt(0)));
      console.log('--------------------------');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId: projectId,
      });
      console.log("Firebase Admin initialized successfully");
    } else {
      // Fallback for local dev without env vars or if using Google Application Default Credentials
      // This might happen in Railway if using a JSON file path approach, but simpler is better first.
      // If implicit auth (GCP) is available:
      console.log(
        "Firebase env vars missing, attempting default credentials/mock..."
      );
      // In a real scenario, we might want to throw or handle this.
      // For now, if we can't init, we can't use DB.
    }
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

export { db };
