import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDy8U0m64kZBzM2e4cl_t13u8hvWQwVI-g",
  authDomain: "slidesync-3cixg.firebaseapp.com",
  projectId: "slidesync-3cixg",
  storageBucket: "slidesync-3cixg.firebasestorage.app",
  messagingSenderId: "1009999857545",
  appId: "1:1009999857545:web:4c026494a90081baf8c358"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app; 