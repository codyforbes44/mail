import React, { useRef } from 'react';
import { Email } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow } from 'date-fns';

interface EmailListProps {
  emails: Email[];
  currentFolder: string;
  selectedEmails: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectEmail: (email: Email) => void;
  searchQuery?: string;
}

export const EmailList = React.memo(function EmailList({ emails, currentFolder, selectedEmails, onToggleSelect, onSelectEmail, searchQuery = '' }: EmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const rowVirtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => windowWidth < 768 ? 88 : 48,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto relative">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const email = emails[virtualRow.index];
          const isSelected = selectedEmails.has(email.id);
          const isUnread = !email.read && currentFolder === 'inbox';

          return (
            <div
              key={email.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={`flex items-start md:items-center py-2.5 md:py-0 px-3 md:px-4 border-b border-gray-100 cursor-pointer hover:shadow-md hover:z-10 transition-all bg-white overflow-hidden ${isSelected ? 'bg-blue-50' : ''}`}
            >
              <div className="flex items-start md:items-center gap-3 md:gap-4 w-full h-full" onClick={() => onSelectEmail(email)}>
                <div className="flex items-center h-6 md:h-full" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => onToggleSelect(email.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                
                <div className={`hidden md:block w-48 truncate pr-4 ${isUnread ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                  {currentFolder === 'sent' 
                    ? <span>To: {highlightText(email.recipientEmail, searchQuery)}</span> 
                    : highlightText(email.senderName || email.senderEmail, searchQuery)}
                </div>
                
                <div className="flex-1 min-w-0 pr-2 flex flex-col md:flex-row md:items-center gap-0 md:gap-2">
                  {/* Mobile Header: Sender + Time */}
                  <div className="flex items-center justify-between md:hidden mb-0.5">
                    <span className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                      {currentFolder === 'sent' 
                        ? <span>To: {highlightText(email.recipientEmail, searchQuery)}</span> 
                        : highlightText(email.senderName || email.senderEmail, searchQuery)}
                    </span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                      {email.createdAt ? formatDistanceToNow(email.createdAt.toDate(), { addSuffix: false }) : ''}
                    </span>
                  </div>

                  {/* Subject */}
                  <span className={`text-sm md:text-base truncate ${isUnread ? 'font-bold text-gray-900' : 'text-gray-800'}`}>
                    {email.subject ? highlightText(email.subject, searchQuery) : '(No Subject)'}
                  </span>

                  {/* Desktop Separator */}
                  <span className="hidden md:inline text-gray-400">-</span>

                  {/* Snippet */}
                  <span className={`text-xs md:text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'text-gray-500 font-normal'}`}>
                    {highlightText(email.snippet || '', searchQuery)}
                  </span>
                </div>
                
                <div className={`hidden md:block w-24 text-right text-sm whitespace-nowrap ${isUnread ? 'font-bold text-gray-900' : 'text-gray-500'}`} title={email.createdAt?.toDate().toLocaleString()}>
                  {email.createdAt ? formatDistanceToNow(email.createdAt.toDate(), { addSuffix: true }) : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
