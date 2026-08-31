import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Textarea } from '../components/ui/textarea';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.conversation_id);
    }
  }, [selectedConv]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      const response = await axios.get(`${API}/conversations/${convId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await axios.post(`${API}/conversations/${selectedConv.conversation_id}/reply`, null, {
        params: { content: replyText }
      });
      toast.success('Reply sent!');
      setReplyText('');
      fetchMessages(selectedConv.conversation_id);
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  return (
    <div className="h-screen flex flex-col" data-testid="inbox-page">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Inbox</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r bg-white" data-testid="conversations-list">
          <ScrollArea className="h-full">
            {conversations.map((conv) => (
              <div
                key={conv.conversation_id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedConv?.conversation_id === conv.conversation_id ? 'bg-indigo-50' : ''
                }`}
                onClick={() => setSelectedConv(conv)}
                data-testid={`conversation-${conv.conversation_id}`}
              >
                <p className="font-medium">{conv.contact?.name}</p>
                <p className="text-sm text-muted-foreground truncate">{conv.contact?.email}</p>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="p-8 text-center text-muted-foreground" data-testid="no-conversations">
                No conversations yet
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col bg-gray-50" data-testid="messages-area">
          {selectedConv ? (
            <>
              <div className="bg-white border-b p-4">
                <h2 className="font-semibold">{selectedConv.contact?.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedConv.contact?.email}</p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.message_id}
                      className={`flex ${
                        msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'
                      }`}
                      data-testid={`message-${msg.message_id}`}
                    >
                      <div
                        className={`max-w-md p-3 rounded-lg ${
                          msg.sender_type === 'staff'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white border'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_type === 'staff' ? 'text-indigo-100' : 'text-muted-foreground'
                        }`}>
                          {new Date(msg.sent_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <form onSubmit={handleReply} className="bg-white border-t p-4" data-testid="reply-form">
                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="resize-none"
                    rows={3}
                    data-testid="reply-input"
                  />
                  <Button type="submit" size="icon" data-testid="send-reply-button">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground" data-testid="no-conversation-selected">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}