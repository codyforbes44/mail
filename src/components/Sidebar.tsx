import React from 'react';
import { Inbox, Send, File, Trash2, PenSquare, LogOut, RefreshCw, Loader2, Archive, MessageSquare, X } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface SidebarProps {
  user: FirebaseUser;
  currentFolder: string;
  setCurrentFolder: (folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive') => void;
  unreadCount: number;
  isImporting: boolean;
  onImport: () => void;
  onCompose: () => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, currentFolder, setCurrentFolder, unreadCount, isImporting, onImport, onCompose, onLogout, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-gray-800">3ʙɪ Mail</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      
      <div className="px-4 py-2">
        <button 
          onClick={onCompose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 px-4 flex items-center gap-2 font-medium shadow-sm transition-colors"
        >
          <PenSquare className="w-5 h-5" />
          Compose <span className="text-blue-200 text-xs ml-auto border border-blue-400 rounded px-1">C</span>
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <FolderItem 
          icon={<Inbox className="w-5 h-5" />} 
          label="Inbox" 
          active={currentFolder === 'inbox'} 
          onClick={() => setCurrentFolder('inbox')} 
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
        <FolderItem icon={<Send className="w-5 h-5" />} label="Sent" active={currentFolder === 'sent'} onClick={() => setCurrentFolder('sent')} />
        <FolderItem icon={<File className="w-5 h-5" />} label="Drafts" active={currentFolder === 'drafts'} onClick={() => setCurrentFolder('drafts')} />
        <FolderItem icon={<Archive className="w-5 h-5" />} label="Archive" active={currentFolder === 'archive'} onClick={() => setCurrentFolder('archive')} />
        <FolderItem icon={<Trash2 className="w-5 h-5" />} label="Trash" active={currentFolder === 'trash'} onClick={() => setCurrentFolder('trash')} />
        
        <div className="pt-8 px-2">
          <button 
            onClick={onImport}
            disabled={isImporting}
            className="w-full bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isImporting ? 'Importing...' : 'Sync from Gmail'}
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200 flex items-center gap-3">
        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="Avatar" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || 'User'}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
        <button onClick={onLogout} className="text-gray-400 hover:text-gray-600" title="Sign out">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  </>
);
}

function FolderItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-colors ${active ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}
