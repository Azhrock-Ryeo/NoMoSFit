import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD2H8TFloTkwAzdBx6nL2de14KT3Zq62u4",
  authDomain: "nomosfit-87015.firebaseapp.com",
  projectId: "nomosfit-87015",
  storageBucket: "nomosfit-87015.firebasestorage.app",
  messagingSenderId: "559823737502",
  appId: "1:559823737502:web:ea8f913cf50621f0e1218f",
  databaseURL: "https://nomosfit-87015-default-rtdb.asia-southeast1.firebasedatabase.app",
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);