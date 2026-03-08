/**
 * ChatPanel - Live Chat Interface
 *
 * Provides UI for viewing and sending chat messages during live streaming.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Reply,
  X,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

interface ChatPanelProps {
  /** Stream slug for chat API */
  streamSlug: string;
  /** Auth token for API calls */
  authToken: string;
  /** Whether the chat is active */
  isActive?: boolean;
}

const API_URL = 'https://api-dev.volantislive.com';

export function ChatPanel({ streamSlug, authToken, isActive = true }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!streamSlug || !authToken) return;

    try {
      const response = await fetch(`${API_URL}/livestreams/${encodeURIComponent(streamSlug)}/chat/messages?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
    }
  }, [streamSlug, authToken]);

  // Poll for new messages
  useEffect(() => {
    if (!isActive || !streamSlug) return;

    // Initial fetch
    fetchMessages();

    // Set up polling
    pollIntervalRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isActive, streamSlug, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !streamSlug || !authToken || isSending) return;

    setIsSending(true);

    try {
      const response = await fetch(`${API_URL}/livestreams/${encodeURIComponent(streamSlug)}/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: messageInput.trim(),
          reply_to_id: replyingTo?.id || null,
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setMessageInput('');
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setIsSending(false);
    }
  }, [messageInput, streamSlug, authToken, replyingTo, isSending]);

  // Handle reply
  const handleReplyTo = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
  }, []);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Format timestamp
  const formatTime = (createdAt: string) => {
    try {
      return new Date(createdAt).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)',
      borderRadius: 8,
      border: '1px solid rgba(56,189,248,0.2)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 400,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 2, height: 14, background: 'rgba(56,189,248,0.7)', borderRadius: 1 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Live Chat
          </span>
        </div>
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: 10, 
          color: 'rgba(255,255,255,0.3)' 
        }}>
          {messages.length} messages
        </span>
      </div>

      {/* Messages list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
        minHeight: 150,
        maxHeight: 250,
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 11,
          }}>
            No messages yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: '#38bdf8', flexShrink: 0 }}>
                    {msg.username}:
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, wordBreak: 'break-word' }}>
                    {msg.content}
                  </span>
                  <button
                    onClick={() => handleReplyTo(msg)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: 'rgba(255,255,255,0.25)',
                      display: 'flex',
                      flexShrink: 0,
                    }}
                    title="Reply"
                  >
                    <Reply style={{ width: 10, height: 10 }} />
                  </button>
                </div>
                <span style={{ 
                  fontSize: 9, 
                  color: 'rgba(255,255,255,0.25)', 
                  marginLeft: 4 
                }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          marginBottom: 8,
          padding: '6px 8px',
          background: 'rgba(56,189,248,0.1)',
          borderRadius: 4,
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
        }}>
          <Reply style={{ width: 10, height: 10 }} />
          <span>Replying to {replyingTo.username}</span>
          <button
            onClick={() => setReplyingTo(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              display: 'flex',
            }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      )}

      {/* Message input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Send a message..."}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!messageInput.trim() || isSending}
          style={{
            padding: '8px 12px',
            background: messageInput.trim() && !isSending 
              ? 'linear-gradient(180deg, #0ea5e9, #0284c7)' 
              : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 6,
            cursor: messageInput.trim() && !isSending ? 'pointer' : 'not-allowed',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: messageInput.trim() && !isSending ? 1 : 0.5,
          }}
        >
          <Send style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}