import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider
} from "firebase/auth";
import {
    getFirestore,
    initializeFirestore,
    memoryLocalCache
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_TOKEN,
    authDomain: import.meta.env.VITE_FIREBASE_A_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log("Firebase Config Check:", JSON.stringify({
    apiKeyPresent: !!firebaseConfig.apiKey,
    authDomainPresent: !!firebaseConfig.authDomain,
    projectIdPresent: !!firebaseConfig.projectId,
    apiKeyLength: firebaseConfig.apiKey ? firebaseConfig.apiKey.length : 0,
    authDomainValue: firebaseConfig.authDomain // Safe to log domain, it's public info usually
}, null, 2));

if (!firebaseConfig.apiKey) {
    console.error("CRITICAL ERROR: Firebase API Key is missing. Check VITE_FIREBASE_API_TOKEN in Vercel.");
}
if (!firebaseConfig.authDomain) {
    console.error("CRITICAL ERROR: Firebase Auth Domain is missing. Check VITE_FIREBASE_A_DOMAIN in Vercel.");
}

// 1. Initialize App safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Auth with extreme robustness for Incognito/Restricted modes
// 2. Initialize Auth with extreme robustness for Incognito/Restricted modes
// Simplified Auth Init for debugging
const authInstance = getAuth(app);
// Original complex logic commented out for now
/*
try {
    // Try to initialize with custom persistence first
    authInstance = initializeAuth(app, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
} catch (e: unknown) {
    // If "failed-precondition" (already initialized), just get the instance
    const err = e as { code?: string };
    if (err.code === 'auth/already-initialized') {
        authInstance = getAuth(app);
    } else {
        // Fallback for strict environments or other errors
        console.warn("Auth persistence fallback enabled due to error", e);
        try {
            authInstance = initializeAuth(app, { persistence: inMemoryPersistence });
        } catch {
            authInstance = getAuth(app);
        }
    }
}
*/
export const auth = authInstance;

// 3. Initialize Firestore with safe defaults (Memory Cache to avoid Storage errors)
let dbInstance;
try {
    // We try to initialize with memory cache explicitly to avoid "Access to storage" errors
    // from default IndexedDB usage in strict browser environments.
    dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache()
    });
} catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'failed-precondition') {
        // Already initialized (HMR), use existing
        dbInstance = getFirestore(app);
    } else {
        console.warn("Firestore Init Error, falling back to default:", error);
        dbInstance = getFirestore(app);
    }
}

export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();
