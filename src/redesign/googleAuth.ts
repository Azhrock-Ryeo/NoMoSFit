import { Platform, TurboModuleRegistry } from 'react-native';
import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
export type GoogleAction = 'signIn' | 'link';
let inProgress = false;
let configuredFor = '';
// Expo inlines statically-addressed EXPO_PUBLIC variables in the JS bundle.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
export function googleStatus() {
  if (Platform.OS !== 'android') return { enabled: false, message: 'Google sign-in in this update is configured for Android only.' };
  if (!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(webClientId)) return { enabled: false, message: 'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the OAuth client of type Web application, then restart Metro.' };
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return { enabled: false, message: 'Google native code is not in this installed APK yet. Rebuild and install the debug APK once; a Metro reload is not enough.' };
  return { enabled: true, message: '' };
}
export async function authenticateGoogle(action: GoogleAction = 'signIn'): Promise<boolean> {
  const status = googleStatus();
  if (!status.enabled) throw new Error(status.message);
  if (inProgress) return false;
  const owner = auth.currentUser;
  if (action === 'link' && !owner) throw new Error('Sign in to your existing account before linking Google.');
  if (action === 'signIn' && owner) throw new Error('Already signed in. Use Link Google in Profile instead.');
  inProgress = true;
  try {
    // Lazy require prevents old installed APKs from throwing on app startup.
    const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    if (configuredFor !== webClientId) { GoogleSignin.configure({ webClientId, offlineAccess: false }); configuredFor = webClientId; }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Clear only Google's native cached selection, NOT the Firebase session.
    await GoogleSignin.signOut();
    let response;
    try { response = await GoogleSignin.signIn(); }
    catch (err) { if ((err as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return false; throw err; }
    if (response.type !== 'success') return false;
    if (auth.currentUser?.uid !== owner?.uid) throw new Error('Your account changed while Google sign-in was open. Try again.');
    const token = response.data.idToken;
    if (!token) throw new Error('Google did not return an ID token. Check the Web client ID and Android signing SHA-1.');
    const credential = GoogleAuthProvider.credential(token);
    if (action === 'link' && owner) await linkWithCredential(owner, credential);
    else await signInWithCredential(auth, credential);
    return true;
  } catch (err) {
    const code = String((err as { code?: unknown })?.code ?? '');
    if (code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') throw new Error('That Google account is already associated with another login. Sign in using your existing method, then link Google in Profile. No local histories were merged or deleted.');
    if (code === 'auth/requires-recent-login') throw new Error('Sign out and sign back in with your existing method, then retry linking Google.');
    if (code === 'auth/operation-not-allowed') throw new Error('Enable Google in Firebase Authentication → Sign-in method.');
    if (code === '10' || code === 'DEVELOPER_ERROR') throw new Error('Google configuration mismatch. Check com.nomosfit.app, the SHA-1 of THIS APK, and the Web client ID.');
    if (code === 'auth/network-request-failed') throw new Error('Google sign-in needs an internet connection. Please retry.');
    throw err;
  } finally { inProgress = false; }
}
