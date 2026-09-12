import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { auth } from '../config/firebase';

export async function signIn(
  email: string,
  password: string
) {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

export async function signUp(
  email: string,
  password: string
) {
  return createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

export async function signOut() {
  return firebaseSignOut(auth);
}