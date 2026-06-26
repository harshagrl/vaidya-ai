import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { Send, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import CitationModal from './CitationModal';

export default function ChatInterface() {
  const { activeProfileId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCitationId, setSelectedCitationId] = useState(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeProfileId) return;
      try {
        const res = await api.get(`/api/profiles/${activeProfileId}/chat`);
        setMessages(res.data.history || []);
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };
    fetchHistory();
  }, [activeProfileId]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeProfileId || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Optimistic UI update
    const tempMessages = [...messages, { role: 'user', parts: [{ text: userMessage }] }];
    setMessages(tempMessages);
    setIsLoading(true);

    try {
      const res = await api.post(`/api/profiles/${activeProfileId}/chat`, { message: userMessage });
      if (res.data.success) {
        setMessages([...tempMessages, { role: 'model', parts: [{ text: res.data.response }] }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      // Revert optimistic update
      setMessages(messages);
      setInput(userMessage); // restore input
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageWithCitations = (text) => {
    const citationRegex = /\[SOURCE:([a-zA-Z0-9_]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let citationCount = 1;
    
    let match;
    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      
      const recordId = match[1];
      parts.push(
        <button
          key={`cit-${match.index}`}
          onClick={() => setSelectedCitationId(recordId)}
          className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-[10px] font-bold w-4 h-4 rounded-full mx-1 align-top cursor-pointer transition-colors border border-indigo-200"
          title="View Source Record"
        >
          {citationCount++}
        </button>
      );
      lastIndex = citationRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }
    
    // Process newlines for standard markdown-like line breaks
    return parts.map((part, i) => {
      if (React.isValidElement(part) && part.type === 'span') {
        const textStr = part.props.children;
        const lines = textStr.split('\n');
        return (
          <span key={`formatted-${i}`}>
            {lines.map((line, j) => (
              <React.Fragment key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      }
      return part;
    });
  };

  if (!activeProfileId) {
    return (
      <div className="max-w-3xl mx-auto mt-8 text-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <p className="text-gray-500">Please select a family member profile from the top header to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[70vh]">
      <div className="bg-indigo-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <MessageSquare className="w-5 h-5" />
          <h2 className="font-semibold">Health Assistant</h2>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-100 text-xs bg-indigo-700/50 px-3 py-1.5 rounded-full">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Grounded in Health Records</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-4">
            <MessageSquare className="w-12 h-12 text-gray-300" />
            <p>Ask a question about your health records or general medicine.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const textContent = msg.parts?.[0]?.text || '';
            
            return (
              <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  isUser 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <div className="text-sm leading-relaxed">
                    {isUser ? textContent : renderMessageWithCitations(textContent)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-4 shadow-sm">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        {error && (
          <p className="text-xs text-red-500 mb-2">{error}</p>
        )}
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your prescriptions, lab tests, or medicines..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border-transparent rounded-full focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {selectedCitationId && (
        <CitationModal 
          recordId={selectedCitationId} 
          onClose={() => setSelectedCitationId(null)} 
        />
      )}
    </div>
  );
}
