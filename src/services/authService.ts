import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';

export const signIn = async (email: string, password: string) => {
  const { auth } = await import('../config/firebase');
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUp = async (email: string, password: string) => {
  const { auth } = await import('../config/firebase');
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signOut = async () => {
  const { auth } = await import('../config/firebase');
  return firebaseSignOut(auth);
};