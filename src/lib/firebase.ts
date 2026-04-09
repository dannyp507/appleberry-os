import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Test connection
import { doc, getDocFromCache } from 'firebase/firestore';
async function testConnection() {
  try {
    await getDocFromCache(doc(db, 'test', 'connection'));
  } catch (e) {
    // Ignore cache errors
  }
}
testConnection();
