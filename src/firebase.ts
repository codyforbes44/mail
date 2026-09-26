import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const GMAIL_TOKEN_KEY = 'gmail_access_token';
const GMAIL_TOKEN_EXPIRES_KEY = 'gmail_access_token_expires';

const saveGmailToken = (token: string) => {
  const expiresAt = Date.now() + 3500 * 1000; // Assume 1 hour minus a small buffer
  localStorage.setItem(GMAIL_TOKEN_KEY, token);
  localStorage.setItem(GMAIL_TOKEN_EXPIRES_KEY, expiresAt.toString());
};

export const signInWithGmailScopes = async () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  provider.addScope('https://www.googleapis.com/auth/gmail.modify');
  provider.addScope('https://mail.google.com/');
  
  try {
    console.log("Attempting signInWithPopup...");
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      saveGmailToken(credential.accessToken);
      console.log("Successfully signed in with popup and stored token.");
    }
    return result.user;
  } catch (error: any) {
    console.error("signInWithPopup error:", error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.log("Popup blocked, falling back to signInWithRedirect...");
      await signInWithRedirect(auth, provider);
    } else {
      throw error;
    }
  }
};

export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveGmailToken(credential.accessToken);
      }
      return { user: result.user, token: credential?.accessToken };
    }
    return null;
  } catch (error) {
    console.error("Error handling redirect result", error);
    throw error;
  }
};

export const getStoredGmailToken = () => {
  const token = localStorage.getItem(GMAIL_TOKEN_KEY);
  const expiresAt = localStorage.getItem(GMAIL_TOKEN_EXPIRES_KEY);
  
  if (!token || !expiresAt) return null;
  
  // If token expires in less than 5 minutes, consider it expired
  if (Date.now() > parseInt(expiresAt) - 300 * 1000) {
    console.log("Gmail token expired or close to expiration.");
    localStorage.removeItem(GMAIL_TOKEN_KEY);
    localStorage.removeItem(GMAIL_TOKEN_EXPIRES_KEY);
    return null;
  }
  
  return token;
};

export const logOut = async () => {
  try {
    localStorage.removeItem(GMAIL_TOKEN_KEY);
    localStorage.removeItem(GMAIL_TOKEN_EXPIRES_KEY);
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
