import React from 'react';
import { Trash2, Archive, MailOpen, Mail } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (selectAll: boolean) => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
  currentFolder?: string;
}

export function BulkActionBar({ selectedCount, totalCount, onSelectAll, onMarkRead, onMarkUnread, onArchive, onDelete, currentFolder }: BulkActionBarProps) {
  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;
  const isSomeSelected = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-4 sticky top-0 z-20">
      <div className="flex items-center">
        <input 
          type="checkbox" 
          checked={isAllSelected}
          ref={input => {
            if (input) input.indeterminate = isSomeSelected;
          }}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
        />
      </div>
      
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 text-gray-600">
          <span className="hidden sm:inline text-sm font-medium mr-2">{selectedCount} selected</span>
          
          <button onClick={onArchive} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Archive">
            <Archive className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title={currentFolder === 'trash' ? "Delete Forever" : "Delete"}>
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button onClick={onMarkRead} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Mark as read">
            <MailOpen className="w-4 h-4" />
          </button>
          <button onClick={onMarkUnread} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Mark as unread">
            <Mail className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
