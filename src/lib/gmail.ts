import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

function decodeBase64(str: string) {
  try {
    return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch (e) {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (err) {
      return "Unable to decode message body.";
    }
  }
}

function extractBody(payload: any): string {
  let body = '';
  if (payload.parts) {
    // Prefer HTML part if available
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    
    if (htmlPart && htmlPart.body?.data) {
      body = decodeBase64(htmlPart.body.data);
    } else if (textPart && textPart.body?.data) {
      body = decodeBase64(textPart.body.data);
    } else {
      // Recursively check parts (e.g. multipart/alternative inside multipart/mixed)
      for (const part of payload.parts) {
        if (part.parts) {
          const nestedBody = extractBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    }
  } else if (payload.body?.data) {
    body = decodeBase64(payload.body.data);
  }
  return body;
}

export async function importFromGmail(accessToken: string) {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;

  try {
    let totalImported = 0;

    const fetchLabel = async (labelId: string, maxResults: number) => {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${labelId}&maxResults=${maxResults}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || response.statusText;
        throw new Error(`Gmail API error (${response.status}): ${errorMessage}`);
      }
      
      const data = await response.json();
      if (!data.messages || data.messages.length === 0) {
        return;
      }

      // Fetch details for each message
      for (const msg of data.messages) {
        // Check if email already exists to prevent duplicates
        const emailRef = doc(collection(db, 'emails'), msg.id);
        const existingDoc = await getDoc(emailRef);
        if (existingDoc.exists()) continue;

        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!msgRes.ok) continue;
        
        const msgData = await msgRes.json();

        // Parse headers
        const headers = msgData.payload.headers;
        const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const fromHeader = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const toHeader = headers.find((h: any) => h.name === 'To')?.value || 'Unknown Recipient';
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value;

        const extractEmail = (header: string) => {
          const match = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          return match ? match[1] : 'unknown@example.com';
        };

        const extractName = (header: string) => {
          const match = header.match(/^([^<]+)</);
          return match ? match[1].trim().replace(/"/g, '') : '';
        };

        const senderEmail = extractEmail(fromHeader);
        const senderName = extractName(fromHeader) || senderEmail;
        const recipientEmail = extractEmail(toHeader);
        const subject = subjectHeader.substring(0, 200);

        // Determine folder based on labels
        let folder = 'inbox';
        if (msgData.labelIds?.includes('TRASH')) folder = 'trash';
        else if (msgData.labelIds?.includes('DRAFT')) folder = 'drafts';
        else if (msgData.labelIds?.includes('SENT')) folder = 'sent';
        else if (!msgData.labelIds?.includes('INBOX')) folder = 'archive'; // If not in inbox, sent, draft, trash, it's archived

        // Parse body
        let body = extractBody(msgData.payload);
        if (!body) body = msgData.snippet || '';
        body = body.substring(0, 100000);

        let snippet = msgData.snippet || body.substring(0, 100).replace(/<[^>]*>?/gm, '');
        snippet = snippet.substring(0, 500);

        let createdAt: any = serverTimestamp();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            createdAt = parsedDate;
          }
        }

        // Save to Firestore
        await setDoc(emailRef, {
          id: msg.id,
          senderId: 'gmail_import',
          senderEmail,
          senderName: senderName.substring(0, 100),
          recipientEmail,
          subject,
          body,
          snippet,
          createdAt,
          read: !msgData.labelIds?.includes('UNREAD'),
          folder,
          ownerId: uid
        });
        
        totalImported++;
      }
    };

    await fetchLabel('INBOX', 50);
    await fetchLabel('SENT', 50);
    await fetchLabel('DRAFT', 20);
    await fetchLabel('TRASH', 20);
    
    console.log(`Successfully imported ${totalImported} new emails.`);
  } catch (error) {
    console.error("Error importing from Gmail:", error);
    throw error;
  }
}
