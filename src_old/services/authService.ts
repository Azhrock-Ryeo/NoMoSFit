import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { auth } from '../config/firebase';

export const signIn = (
  email: string,
  password: string
) => {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
};

export const signUp = (
  email: string,
  password: string
) => {
  return createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
};

export const signOut = () => {
  return firebaseSignOut(auth);
};