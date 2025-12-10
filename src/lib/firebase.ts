import { initializeApp, getApps, getApp } from "firebase/app";
import {
    initializeAuth,
    getAuth,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
    GoogleAuthProvider
} from "firebase/auth";
import {
    getFirestore,
    initializeFirestore,
    memoryLocalCache
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 1. Initialize App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Auth with extreme robustness for Incognito/Restricted modes
let authInstance;
try {
    // Attempt standard persistence chain
    authInstance = initializeAuth(app, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    });
} catch (error: any) {
    if (error.code === 'auth/already-initialized') {
        authInstance = getAuth(app);
    } else {
        // Fallback to memory
        try {
            authInstance = initializeAuth(app, {
                persistence: inMemoryPersistence
            });
        } catch (innerError: any) {
            if (innerError.code === 'auth/already-initialized') {
                authInstance = getAuth(app);
            } else {
                console.error("Critical Auth Init Error:", innerError);
                throw innerError;
            }
        }
    }
}
export const auth = authInstance;

// 3. Initialize Firestore with safe defaults (Memory Cache to avoid Storage errors)
let dbInstance;
try {
    // We try to initialize with memory cache explicitly to avoid "Access to storage" errors
    // from default IndexedDB usage in strict browser environments.
    dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache()
    });
} catch (error: any) {
    if (error.code === 'failed-precondition') {
        // Already initialized (HMR), use existing
        dbInstance = getFirestore(app);
    } else {
        console.warn("Firestore Init Error, falling back to default:", error);
        dbInstance = getFirestore(app);
    }
}

export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();
