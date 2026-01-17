import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { AskResponse } from '@r3cent/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: AskResponse['sources'];
}

export function Ask() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await apiClient.ask(userMessage.text, sessionId ?? undefined) as AskResponse;
      
      if (!sessionId) {
        setSessionId(response.sessionId);
      }
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: response.answer,
        sources: response.sources,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <header className="p-4 border-b border-slate-800/50">
        <h1 className="text-xl font-bold">Ask</h1>
        <p className="text-slate-400 text-sm">Ask questions about your recent activity</p>
      </header>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-6">
              Ask me anything about your recent activity
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-sm px-3 py-2 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors text-slate-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What do you want to know?"
            className="input flex-1"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-slate-800/50 text-slate-200'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <button
              onClick={() => setShowSources(!showSources)}
              className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
            >
              <span>{message.sources.length} sources</span>
              <ChevronIcon className={`w-3 h-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
            </button>
            
            {showSources && (
              <ul className="mt-2 space-y-1">
                {message.sources.map((source) => (
                  <li key={source.itemId} className="text-xs text-slate-400">
                    • {source.type}: {source.reason || 'Referenced'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What's on my calendar this week?",
  "Summarize my recent thoughts",
  "What emails should I follow up on?",
  "What have I been listening to?",
];

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
