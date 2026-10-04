import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocFromServer, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Email, OperationType, FirestoreErrorInfo } from '../types';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection check: client is offline or backend is unreachable. Please verify your Firebase configuration.");
    }
  }
}
testConnection();

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function ensureUserProfile() {
  if (!auth.currentUser) return;
  const user = auth.currentUser;
  
  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: 'user'
      });

      // Send a welcome email
      const inboxRef = doc(collection(db, 'emails'));
      await setDoc(inboxRef, {
        id: inboxRef.id,
        senderId: 'system',
        senderEmail: 'system@3bi.world',
        senderName: '3ʙɪ Mail Team',
        recipientEmail: user.email,
        subject: 'Welcome to 3ʙɪ Mail!',
        body: 'Welcome to 3ʙɪ Mail! Your secure email client is ready to use.\n\nYou can send emails, save drafts, and use Gemini AI to summarize messages or generate smart replies.',
        snippet: 'Welcome to 3ʙɪ Mail! Your secure email client is ready to use.',
        createdAt: serverTimestamp(),
        read: false,
        folder: 'inbox',
        ownerId: user.uid
      });
    }

    if (user.email) {
      const emailRef = doc(db, 'emailToUid', user.email);
      const emailDoc = await getDoc(emailRef);
      if (!emailDoc.exists()) {
        await setDoc(emailRef, {
          uid: user.uid
        });
      }
    }
  } catch (error) {
    console.error("Error ensuring user profile:", error);
  }
}

export async function sendEmail(recipientEmail: string, subject: string, body: string) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  
  const senderId = auth.currentUser.uid;
  const senderEmail = auth.currentUser.email!;
  const senderName = auth.currentUser.displayName || senderEmail.split('@')[0];
  const snippet = body.substring(0, 100) + (body.length > 100 ? '...' : '');
  
  const emailData = {
    senderId,
    senderEmail,
    senderName,
    recipientEmail,
    subject,
    body,
    snippet,
    createdAt: serverTimestamp(),
    read: false,
  };

  try {
    // 1. Save to sender's 'sent' folder
    const sentRef = doc(collection(db, 'emails'));
    await setDoc(sentRef, {
      ...emailData,
      id: sentRef.id,
      folder: 'sent',
      ownerId: senderId,
      read: true, 
    });

    // 2. Handle multiple recipients
    const recipients = recipientEmail.split(',').map(r => r.trim()).filter(Boolean);
    
    for (const email of recipients) {
      // Look up recipient UID
      const recipientUidDoc = await getDoc(doc(db, 'emailToUid', email));
      if (recipientUidDoc.exists()) {
        const recipientUid = recipientUidDoc.data().uid;
        // 3. Save to recipient's 'inbox' folder
        const inboxRef = doc(collection(db, 'emails'));
        await setDoc(inboxRef, {
          ...emailData,
          recipientEmail: email, // Set specific recipient for this copy
          id: inboxRef.id,
          folder: 'inbox',
          ownerId: recipientUid,
          read: false,
        });
      } else {
        console.warn(`Recipient ${email} not found in emailToUid mapping. Email only saved to sent folder for this recipient.`);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'emails');
  }
}

export async function saveDraft(subject: string, body: string, recipientEmail: string) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  
  const senderId = auth.currentUser.uid;
  const senderEmail = auth.currentUser.email!;
  const senderName = auth.currentUser.displayName || senderEmail.split('@')[0];
  const snippet = body.substring(0, 100) + (body.length > 100 ? '...' : '');
  
  try {
    const draftRef = doc(collection(db, 'emails'));
    await setDoc(draftRef, {
      id: draftRef.id,
      senderId,
      senderEmail,
      senderName,
      recipientEmail,
      subject,
      body,
      snippet,
      createdAt: serverTimestamp(),
      read: true,
      folder: 'drafts',
      ownerId: senderId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'emails');
  }
}

export async function markAsRead(emailId: string) {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'emails', emailId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `emails/${emailId}`);
  }
}

export async function moveToTrash(emailId: string) {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'emails', emailId), { folder: 'trash' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `emails/${emailId}`);
  }
}

export async function archiveEmail(emailId: string) {
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, 'emails', emailId), { folder: 'archive' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `emails/${emailId}`);
  }
}

export async function bulkUpdateEmails(emailIds: string[], data: Partial<Email>) {
  if (!auth.currentUser) return;
  try {
    const promises = emailIds.map(id => updateDoc(doc(db, 'emails', id), data));
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `emails/bulk`);
  }
}

export async function permanentlyDeleteEmails(emailIds: string[]) {
  if (!auth.currentUser) return;
  try {
    const promises = emailIds.map(id => deleteDoc(doc(db, 'emails', id)));
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `emails/bulk`);
  }
}

export function subscribeToEmails(folder: string, callback: (emails: Email[]) => void) {
  if (!auth.currentUser) return () => {};
  
  const q = query(
    collection(db, 'emails'),
    where('ownerId', '==', auth.currentUser.uid),
    where('folder', '==', folder)
  );

  return onSnapshot(q, (snapshot) => {
    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt || Timestamp.now(), // Handle pending writes
      } as Email;
    });
    
    // Sort on the client side to avoid needing a composite index
    emails.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    
    callback(emails);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'emails');
  });
}
