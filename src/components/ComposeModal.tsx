import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { sendEmail, saveDraft } from '../lib/firestore';
import { draftEmailWithThinking } from '../lib/gemini';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  onClose: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

export function ComposeModal({ onClose, initialTo = '', initialSubject = '', initialBody = '' }: ComposeModalProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [isSending, setIsSending] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  // Focus trap and escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = async () => {
    if (!to || !body) return;
    setIsSending(true);
    try {
      await sendEmail(to, subject, body);
      toast.success('Message sent');
      onClose();
    } catch (e) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSending(true);
    try {
      await saveDraft(subject, body, to);
      toast.success('Draft saved');
      onClose();
    } catch (e) {
      toast.error('Failed to save draft');
    } finally {
      setIsSending(false);
    }
  };

  const handleAiDraft = async () => {
    if (!aiPrompt) return;
    setIsDrafting(true);
    try {
      const draft = await draftEmailWithThinking(aiPrompt);
      setBody(prev => prev ? `${draft}\n\n${prev}` : draft);
      toast.success('Draft generated');
    } catch (e) {
      toast.error('Failed to generate draft');
    } finally {
      setIsDrafting(false);
      setAiPrompt('');
    }
  };

  return (
    <div className="fixed bottom-0 right-0 md:right-24 w-full md:w-[500px] h-full md:h-[600px] bg-white md:rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      <div className="bg-gray-800 text-white px-4 py-3 md:rounded-t-xl flex items-center justify-between shrink-0">
        <span className="font-medium">New Message</span>
        <button onClick={onClose} className="text-gray-300 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-2 flex items-center">
          <span className="text-gray-500 w-12 text-sm">To</span>
          <input type="email" value={to} onChange={e => setTo(e.target.value)} className="flex-1 outline-none text-sm" autoFocus={!initialTo} />
        </div>
        <div className="border-b border-gray-100 px-4 py-2 flex items-center">
          <span className="text-gray-500 w-12 text-sm">Subject</span>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="flex-1 outline-none text-sm font-medium" autoFocus={!!initialTo && !initialSubject} />
        </div>
        
        {/* AI Drafting Tool */}
        <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Help me write (High Thinking)</span>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="E.g., Write a polite decline to a job offer..." 
              className="flex-1 text-sm px-3 py-1.5 rounded border border-purple-200 focus:outline-none focus:border-purple-400"
              onKeyDown={e => e.key === 'Enter' && handleAiDraft()}
            />
            <button 
              onClick={handleAiDraft}
              disabled={isDrafting || !aiPrompt}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center"
            >
              {isDrafting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Draft'}
            </button>
          </div>
        </div>

        <textarea 
          value={body}
          onChange={e => setBody(e.target.value)}
          className="flex-1 w-full p-4 outline-none resize-none text-gray-800"
          autoFocus={!!initialTo && !!initialSubject}
        />
      </div>
      <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <button 
          onClick={handleSend}
          disabled={isSending || !to || !body}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
        </button>
        <button onClick={handleSaveDraft} className="text-gray-500 hover:text-gray-700 text-sm font-medium p-2">
          Save Draft
        </button>
      </div>
    </div>
  );
}
