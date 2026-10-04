import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, signInWithGmailScopes, handleRedirectResult, getStoredGmailToken, logOut } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ensureUserProfile, subscribeToEmails, markAsRead, moveToTrash, archiveEmail, bulkUpdateEmails, permanentlyDeleteEmails } from './lib/firestore';
import { Email } from './types';
import { Search, User, MessageSquare, Loader2, Inbox, PenSquare, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { importFromGmail } from './lib/gmail';
import { Toaster, toast } from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Components
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { EmailList } from './components/EmailList';
import { EmailDetail } from './components/EmailDetail';
import { ComposeModal } from './components/ComposeModal';
import { BulkActionBar } from './components/BulkActionBar';

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [currentFolder, setCurrentFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash' | 'archive'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Compose state for reply/forward
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await handleRedirectResult();
        if (result?.token) {
          console.log("Got access token from redirect result");
          toast.success("Gmail connected! Click Sync to import emails.");
        }
      } catch (e: any) {
        console.warn("Redirect check status:", e?.message || e);
      }
    };
    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await ensureUserProfile();
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && isAuthReady) {
      const unsubscribe = subscribeToEmails(currentFolder, (fetchedEmails) => {
        setEmails(fetchedEmails);
      });
      return () => unsubscribe();
    }
  }, [user, isAuthReady, currentFolder]);

  // Reset selection when folder changes
  useEffect(() => {
    setSelectedEmailIds(new Set());
    setSelectedEmail(null);
  }, [currentFolder]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'c':
          e.preventDefault();
          openCompose();
          break;
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'e':
          e.preventDefault();
          if (selectedEmail) {
            handleArchive(selectedEmail.id);
            setSelectedEmail(null);
          } else if (selectedEmailIds.size > 0) {
            handleBulkArchive();
          }
          break;
        case '#':
          e.preventDefault();
          if (selectedEmail) {
            handleDelete(selectedEmail.id);
            setSelectedEmail(null);
          } else if (selectedEmailIds.size > 0) {
            handleBulkDelete();
          }
          break;
        case 'r':
          e.preventDefault();
          if (selectedEmail) {
            // We need to trigger the reply action on the detail view. 
            // The detail view has its own handleReply, but we can just set compose state here.
            const subject = selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`;
            const dateStr = selectedEmail.createdAt?.toDate().toLocaleString() || '';
            const body = `\n\nOn ${dateStr}, ${selectedEmail.senderName || selectedEmail.senderEmail} wrote:\n> ${selectedEmail.body.replace(/\n/g, '\n> ')}`;
            openCompose(selectedEmail.senderEmail, subject, body);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmail, selectedEmailIds]);

  const handleImportGmail = async () => {
    setIsImporting(true);
    try {
      let token = getStoredGmailToken();
      console.log("Sync from Gmail clicked. Current token status:", token ? "Present" : "Missing");
      
      if (!token) {
        toast.loading("Requesting Gmail access...", { id: 'gmail-auth' });
        await signInWithGmailScopes();
        
        // Check if token was acquired via popup
        token = getStoredGmailToken();
        if (!token) {
          // If still no token, it likely triggered a redirect
          return; 
        }
        toast.success("Gmail access granted!", { id: 'gmail-auth' });
      }
      
      if (token) {
        console.log("Starting import with token...");
        const importToast = toast.loading("Fetching emails from Gmail...");
        await importFromGmail(token);
        toast.dismiss(importToast);
        toast.success("Successfully imported recent emails from Gmail!");
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || "An error occurred during import.";
      
      if (errorMsg.includes('403') && errorMsg.includes('Gmail API has not been used')) {
        const match = errorMsg.match(/project=(\d+)/);
        const projectId = match ? match[1] : '';
        const url = `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview${projectId ? `?project=${projectId}` : ''}`;
        
        toast.error(
          (t) => (
            <div className="flex flex-col gap-2">
              <span className="font-semibold">Gmail API is disabled</span>
              <span className="text-sm">You need to enable the Gmail API in your Google Cloud project before importing.</span>
              <a 
                href={url} 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-blue-600 underline mt-1"
                onClick={() => toast.dismiss(t.id)}
              >
                Click here to enable it
              </a>
            </div>
          ),
          { duration: 10000 }
        );
      } else if (errorMsg.includes('insufficient authentication scopes') || errorMsg.includes('403')) {
        toast.error(
          (t) => (
            <div className="flex flex-col gap-2">
              <span className="font-semibold">Permission Denied</span>
              <span className="text-sm">You <b>MUST</b> check all Gmail permission boxes during sign-in.</span>
              <button 
                onClick={() => {
                  toast.dismiss(t.id);
                  logOut().then(() => window.location.reload());
                }}
                className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded mt-1 font-medium"
              >
                Sign out & Try Again
              </button>
            </div>
          ),
          { duration: 10000 }
        );
      } else {
        toast.error(errorMsg, { duration: 6000 });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emails;
    const lowerQuery = searchQuery.toLowerCase();
    return emails.filter(e => 
      e.subject.toLowerCase().includes(lowerQuery) ||
      e.senderName?.toLowerCase().includes(lowerQuery) ||
      e.senderEmail.toLowerCase().includes(lowerQuery) ||
      e.recipientEmail.toLowerCase().includes(lowerQuery) ||
      e.body.toLowerCase().includes(lowerQuery)
    );
  }, [emails, searchQuery]);

  const unreadCount = useMemo(() => {
    // We only have the current folder's emails in state. 
    // To get a true inbox unread count, we'd need a separate listener or query.
    // For now, we'll just show the count for the current folder if it's inbox.
    if (currentFolder === 'inbox') {
      return emails.filter(e => !e.read).length;
    }
    return 0; // Ideally we'd fetch this globally
  }, [emails, currentFolder]);

  const openCompose = (to = '', subject = '', body = '') => {
    setComposeTo(to);
    setComposeSubject(subject);
    setComposeBody(body);
    setIsComposing(true);
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.read && currentFolder === 'inbox') {
      markAsRead(email.id);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedEmailIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEmailIds(newSet);
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedEmailIds(new Set(filteredEmails.map(e => e.id)));
    } else {
      setSelectedEmailIds(new Set());
    }
  };

  const updateEmails = async (ids: Set<string>, data: Partial<Email>) => {
    await bulkUpdateEmails(Array.from(ids), data);
  };

  const handleBulkMarkRead = async () => {
    await updateEmails(selectedEmailIds, { read: true });
    setSelectedEmailIds(new Set());
    toast.success('Marked as read');
  };

  const handleBulkMarkUnread = async () => {
    await updateEmails(selectedEmailIds, { read: false });
    setSelectedEmailIds(new Set());
    toast.success('Marked as unread');
  };

  const handleBulkArchive = async () => {
    await updateEmails(selectedEmailIds, { folder: 'archive' });
    setSelectedEmailIds(new Set());
    toast.success('Archived');
  };

  const handleBulkDelete = async () => {
    if (currentFolder === 'trash') {
      if (confirm('Permanently delete selected emails?')) {
        await permanentlyDeleteEmails(Array.from(selectedEmailIds));
        setSelectedEmailIds(new Set());
        toast.success('Permanently deleted');
      }
    } else {
      await updateEmails(selectedEmailIds, { folder: 'trash' });
      setSelectedEmailIds(new Set());
      toast.success('Moved to trash');
    }
  };

  const handleEmptyTrash = async () => {
    const trashIds = emails.map(e => e.id);
    if (trashIds.length === 0) return;
    if (confirm('Delete all messages in Trash forever?')) {
      await permanentlyDeleteEmails(trashIds);
      toast.success('Trash emptied');
    }
  };

  const handleArchive = async (id: string) => {
    await archiveEmail(id);
    toast.success('Archived');
  };

  const handleDelete = async (id: string) => {
    if (currentFolder === 'trash') {
      if (confirm('Permanently delete this email?')) {
        await permanentlyDeleteEmails([id]);
        toast.success('Permanently deleted');
      }
    } else {
      await moveToTrash(id);
      toast.success('Moved to trash');
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    const loginToast = toast.loading("Connecting to Google...");
    try {
      await signInWithGmailScopes();
      toast.dismiss(loginToast);
    } catch (e: any) {
      toast.dismiss(loginToast);
      const errorMsg = e.message || "An error occurred during sign in.";
      setLoginError(errorMsg);
      toast.error(errorMsg, { duration: 8000 });
      console.warn("Login error:", e?.message || e);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>;
  }

  if (!user) {
    const isSuspendedKey = loginError?.includes('suspended') || loginError?.includes('permission-denied');

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <Toaster position="bottom-left" />
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">3ʙɪ Mail</h1>
          <p className="text-gray-500 mb-6">Sign in to access your secure email.</p>

          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-semibold text-red-900">
                    {isSuspendedKey ? "Firebase API Key Suspended" : "Sign In Failed"}
                  </p>
                  <p>
                    {isSuspendedKey 
                      ? "The API key for Google Cloud project 'cf-03026' has been suspended by Google Cloud. This happens if project billing is paused or the API key has been disabled in the Google Cloud Console."
                      : loginError}
                  </p>
                  {isSuspendedKey && (
                    <div className="pt-2 flex flex-col gap-1.5 border-t border-red-200 mt-2">
                      <a
                        href="https://console.cloud.google.com/apis/credentials?project=cf-03026"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                      >
                        Check Google Cloud Credentials <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href="https://console.firebase.google.com/project/cf-03026"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                      >
                        Check Firebase Console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <Toaster position="bottom-left" />
      
      <Sidebar 
        user={user}
        currentFolder={currentFolder}
        setCurrentFolder={(folder) => { setCurrentFolder(folder); setIsSidebarOpen(false); }}
        unreadCount={unreadCount}
        isImporting={isImporting}
        onImport={handleImportGmail}
        onCompose={() => { openCompose(); setIsSidebarOpen(false); }}
        onLogout={logOut}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 flex items-center px-4 md:px-6 bg-white shrink-0 gap-4 sticky top-0 z-30 shadow-sm md:shadow-none">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <div className="flex-1 max-w-2xl relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search in mail (/)" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg pl-10 pr-10 py-2 outline-none transition-all text-sm md:text-base"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedEmail ? (
            <EmailDetail 
              email={selectedEmail} 
              onBack={() => setSelectedEmail(null)} 
              onDelete={() => { handleDelete(selectedEmail.id); setSelectedEmail(null); }}
              onArchive={() => { handleArchive(selectedEmail.id); setSelectedEmail(null); }}
              onReply={(to, subject, body) => openCompose(to, subject, body)}
              onForward={(subject, body) => openCompose('', subject, body)}
            />
          ) : (
            <>
              <BulkActionBar 
                selectedCount={selectedEmailIds.size}
                totalCount={filteredEmails.length}
                onSelectAll={handleSelectAll}
                onMarkRead={handleBulkMarkRead}
                onMarkUnread={handleBulkMarkUnread}
                onArchive={handleBulkArchive}
                onDelete={handleBulkDelete}
                currentFolder={currentFolder}
              />

              {currentFolder === 'trash' && filteredEmails.length > 0 && (
                <div className="bg-gray-50 border-b border-gray-100 py-2 px-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span>Messages in Trash will be deleted forever.</span>
                  <button 
                    onClick={handleEmptyTrash}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Empty Trash now
                  </button>
                </div>
              )}
              
              {isImporting && filteredEmails.length === 0 ? (
                <div className="flex-1 p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                      <div className="w-48 h-4 bg-gray-200 rounded"></div>
                      <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                      <div className="w-24 h-4 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Inbox className="w-16 h-16 mb-4 text-gray-200" />
                  <p className="text-lg font-medium text-gray-600">Nothing to see here</p>
                  <p className="text-sm text-gray-400">Your {currentFolder} is empty.</p>
                </div>
              ) : (
                <EmailList 
                  emails={filteredEmails}
                  currentFolder={currentFolder}
                  selectedEmails={selectedEmailIds}
                  onToggleSelect={toggleSelect}
                  onSelectEmail={handleSelectEmail}
                  searchQuery={searchQuery}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Compose FAB */}
      <button 
        onClick={() => openCompose()}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-30 active:scale-95 transition-transform"
      >
        <PenSquare className="w-6 h-6" />
      </button>

      {/* Compose Modal */}
      {isComposing && (
        <ComposeModal 
          onClose={() => setIsComposing(false)} 
          initialTo={composeTo}
          initialSubject={composeSubject}
          initialBody={composeBody}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
