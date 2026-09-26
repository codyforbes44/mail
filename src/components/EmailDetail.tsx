import React, { useState } from 'react';
import { Email } from '../types';
import { Trash2, Sparkles, MapPin, Search, X, Loader2, Reply, Forward, Archive, Users } from 'lucide-react';
import { summarizeEmail, generateSmartReply, findPlacesMentioned, searchWebForContext } from '../lib/gemini';
import Markdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { formatDistanceToNow } from 'date-fns';

interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onReply: (to: string, subject: string, body: string) => void;
  onForward: (subject: string, body: string) => void;
}

export function EmailDetail({ email, onBack, onDelete, onArchive, onReply, onForward }: EmailDetailProps) {
  const [aiResponse, setAiResponse] = useState<{ title: string, content: string, sources?: string[] } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleSummarize = async () => {
    setIsAiLoading(true);
    const summary = await summarizeEmail(email.body);
    setAiResponse({ title: "Summary", content: summary });
    setIsAiLoading(false);
  };

  const handleSmartReply = async () => {
    setIsAiLoading(true);
    const reply = await generateSmartReply(email.body);
    setAiResponse({ title: "Smart Reply Draft", content: reply });
    setIsAiLoading(false);
  };

  const handleFindPlaces = async () => {
    setIsAiLoading(true);
    const result = await findPlacesMentioned(email.body);
    setAiResponse({ title: "Places Mentioned", content: result.text, sources: result.sources });
    setIsAiLoading(false);
  };

  const handleSearchContext = async () => {
    setIsAiLoading(true);
    const result = await searchWebForContext(email.subject + " " + email.snippet);
    setAiResponse({ title: "Web Context", content: result.text, sources: result.sources });
    setIsAiLoading(false);
  };

  const handleReply = () => {
    const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
    const dateStr = email.createdAt?.toDate().toLocaleString() || '';
    const body = `\n\nOn ${dateStr}, ${email.senderName || email.senderEmail} wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`;
    onReply(email.senderEmail, subject, body);
  };

  const handleReplyAll = () => {
    const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
    const dateStr = email.createdAt?.toDate().toLocaleString() || '';
    const body = `\n\nOn ${dateStr}, ${email.senderName || email.senderEmail} wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`;
    
    // Construct list of unique recipients excluding current user
    const recipients = new Set<string>();
    recipients.add(email.senderEmail);
    
    // Add original recipient if it's not the current user
    // Note: In a real app we'd check against auth.currentUser.email
    // For now we add the recipientEmail field from the doc
    if (email.recipientEmail) {
      recipients.add(email.recipientEmail);
    }
    
    // Convert to comma separated string
    const to = Array.from(recipients).join(', ');
    onReply(to, subject, body);
  };

  const handleForward = () => {
    const subject = email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`;
    const dateStr = email.createdAt?.toDate().toLocaleString() || '';
    const body = `\n\n---------- Forwarded message ---------\nFrom: ${email.senderName || email.senderEmail} <${email.senderEmail}>\nDate: ${dateStr}\nSubject: ${email.subject}\nTo: ${email.recipientEmail}\n\n${email.body}`;
    onForward(subject, body);
  };

  const cleanHtml = DOMPurify.sanitize(email.body, { USE_PROFILES: { html: true } });
  const isHtml = cleanHtml !== email.body && cleanHtml.includes('<');

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="h-14 border-b border-gray-200 flex items-center px-2 md:px-6 gap-2 md:gap-4 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <button onClick={onArchive} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Archive (e)">
          <Archive className="w-5 h-5" />
        </button>
        <button onClick={onDelete} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Move to trash (#)">
          <Trash2 className="w-5 h-5" />
        </button>
        <div className="flex-1"></div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button onClick={handleSummarize} className="flex items-center gap-1 px-3 py-1.5 text-xs md:text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md transition-colors whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /> Summarize
          </button>
          <button onClick={handleSmartReply} className="flex items-center gap-1 px-3 py-1.5 text-xs md:text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /> Smart Reply
          </button>
          <button onClick={handleFindPlaces} className="flex items-center gap-1 px-3 py-1.5 text-xs md:text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors whitespace-nowrap">
            <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" /> Find Places
          </button>
          <button onClick={handleSearchContext} className="flex items-center gap-1 px-3 py-1.5 text-xs md:text-sm bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-md transition-colors whitespace-nowrap">
            <Search className="w-3.5 h-3.5 md:w-4 md:h-4" /> Web Context
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
        <div className="flex-1 p-4 md:p-8 max-w-4xl">
          <h1 className="text-xl md:text-2xl font-normal text-gray-900 mb-4 md:mb-6">{email.subject}</h1>
          <div className="flex items-start gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-base md:text-lg shrink-0">
              {(email.senderName || email.senderEmail)[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-between">
                <div className="font-medium text-sm md:text-base text-gray-900 truncate pr-4">
                  {email.senderName || email.senderEmail} <span className="hidden md:inline text-sm text-gray-500 font-normal">&lt;{email.senderEmail}&gt;</span>
                </div>
                <div className="text-xs md:text-sm text-gray-500 whitespace-nowrap" title={email.createdAt?.toDate().toLocaleString()}>
                  {email.createdAt ? formatDistanceToNow(email.createdAt.toDate(), { addSuffix: true }) : ''}
                </div>
              </div>
              <div className="text-xs md:text-sm text-gray-500 truncate">to {email.recipientEmail}</div>
            </div>
          </div>
          
          <div className="prose prose-sm md:prose-base max-w-none text-gray-800">
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
            ) : (
              <div className="whitespace-pre-wrap break-words">{email.body}</div>
            )}
          </div>
          
          <div className="mt-8 pt-6 md:pt-8 border-t border-gray-100 flex flex-wrap gap-2 md:gap-3">
            <button onClick={handleReply} className="flex-1 md:flex-none px-4 md:px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 text-sm md:text-base font-medium flex items-center justify-center gap-2">
              <Reply className="w-4 h-4" /> Reply
            </button>
            <button onClick={handleReplyAll} className="flex-1 md:flex-none px-4 md:px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 text-sm md:text-base font-medium flex items-center justify-center gap-2">
              <Users className="w-4 h-4" /> Reply All
            </button>
            <button onClick={handleForward} className="flex-1 md:flex-none px-4 md:px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 text-sm md:text-base font-medium flex items-center justify-center gap-2">
              <Forward className="w-4 h-4" /> Forward
            </button>
          </div>
        </div>

        {/* AI Panel */}
        {(aiResponse || isAiLoading) && (
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50 p-4 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                {aiResponse?.title || "AI Assistant"}
              </h3>
              <button onClick={() => setAiResponse(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-none">
              {isAiLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : aiResponse ? (
                <div className="space-y-4">
                  <div className="prose prose-sm prose-purple">
                    <Markdown>{aiResponse.content}</Markdown>
                  </div>
                  {aiResponse.sources && aiResponse.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sources</h4>
                      <ul className="space-y-1">
                        {aiResponse.sources.map((src, i) => (
                          <li key={i}>
                            <a href={src} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                              {src}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
