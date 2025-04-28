import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyB_cQBZ9JT4A6OdaH7AjSN3WxAzVMZczcc",
    authDomain: "wire-project-7868a.firebaseapp.com",
    projectId: "wire-project-7868a",
    storageBucket: "wire-project-7868a.firebasestorage.app",
    messagingSenderId: "968701587345",
    appId: "1:968701587345:web:7f2c92de7b18802bdaf430",
    measurementId: "G-X1HPLW65LW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
