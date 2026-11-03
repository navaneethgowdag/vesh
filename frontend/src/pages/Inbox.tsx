import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  Send,
  MoreVertical,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Share2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { Conversation, Message, UserSearchResult } from '../types';

export const Inbox: React.FC = () => {
  const currentUser = useCurrentUser();
  const { showToast } = useApp();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const typeParam = activeTab === 'all' ? undefined : activeTab;
      const data = await api.messages.listConversations(typeParam);
      setConversations(data);
      if (data.length > 0 && !activeConversation) {
        setActiveConversation(data[0]);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load conversations', 'error');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [activeTab]);

  const loadMessages = async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await api.messages.listMessages(convId);
      setMessages(msgs);
      // Mark as read in local conversation state
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load messages', 'error');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id);
    }
  }, [activeConversation?.id]);

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !messageText.trim()) return;

    setIsSending(true);
    try {
      const newMsg = await api.messages.sendMessage(activeConversation.id, {
        message_type: 'text',
        text_content: messageText.trim(),
      });
      setMessages((prev) => [...prev, newMsg]);
      setMessageText('');
      setTimeout(scrollToBottom, 50);

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, last_message: newMsg, updated_at: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // User search for new chat
  useEffect(() => {
    if (!isNewChatModalOpen) return;
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await api.users.search(userSearchQuery.trim());
        setUserSearchResults(results.filter((u) => u.id !== currentUser?.id));
      } catch {
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearchQuery, isNewChatModalOpen]);

  const handleCreateDirectChat = async (recipientId: string) => {
    try {
      const conv = await api.messages.createConversation({
        conversation_type: 'direct',
        recipient_user_id: recipientId,
      });
      setIsNewChatModalOpen(false);
      setActiveConversation(conv);
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id);
        return exists ? prev : [conv, ...prev];
      });
    } catch (err: any) {
      showToast(err?.message || 'Failed to create chat', 'error');
    }
  };

  const handleCreateGroupChat = async () => {
    if (!groupTitle.trim()) {
      showToast('Please enter a group title', 'error');
      return;
    }
    if (selectedUserIds.length === 0) {
      showToast('Please select at least one friend to add to group', 'error');
      return;
    }

    try {
      const conv = await api.messages.createConversation({
        conversation_type: 'group',
        title: groupTitle.trim(),
        participant_user_ids: selectedUserIds,
      });
      setIsNewChatModalOpen(false);
      setGroupTitle('');
      setSelectedUserIds([]);
      setActiveConversation(conv);
      setConversations((prev) => [conv, ...prev]);
      showToast(`Group "${conv.title}" created!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create group', 'error');
    }
  };

  const handleBlockUser = async () => {
    if (!activeConversation || activeConversation.conversation_type !== 'direct') return;
    const other = activeConversation.other_participant;
    if (!other) return;

    if (confirm(`Block @${other.username}? You will not be able to message each other.`)) {
      try {
        await api.messages.blockUser(other.id);
        showToast(`Blocked @${other.username}`, 'info');
      } catch (err: any) {
        showToast(err?.message || 'Failed to block user', 'error');
      }
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title && c.title.toLowerCase().includes(q);
    const otherMatch = c.other_participant && c.other_participant.name.toLowerCase().includes(q);
    return titleMatch || otherMatch;
  });

  return (
    <AppShell showRightSidebar={false}>
      <div className="h-[calc(100vh-8.5rem)] flex rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        {/* LEFT COLUMN: CONVERSATION LIST */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Messages
            </h1>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsNewChatModalOpen(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              New Chat
            </Button>
          </div>

          {/* Search & Tabs */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex gap-1">
              {(['all', 'direct', 'group'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-xs font-semibold rounded capitalize transition-all ${
                    activeTab === tab
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Circles'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {isLoadingConversations ? (
              <div className="py-12 text-center">
                <Sparkles className="w-5 h-5 text-zinc-400 animate-spin mx-auto mb-1.5" />
                <p className="text-xs text-zinc-500">Loading chats...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 text-center px-4">
                <MessageSquare className="w-7 h-7 text-zinc-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No chats found</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Start a conversation or share an outfit to begin chatting.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = activeConversation?.id === c.id;
                const isGroup = c.conversation_type === 'group';
                const displayName = isGroup
                  ? c.title || 'Fashion Circle'
                  : c.other_participant?.name || 'Direct Chat';
                const avatarUrl = isGroup ? c.image_url : c.other_participant?.avatar;

                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveConversation(c)}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800/80'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="relative">
                      {isGroup ? (
                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200">
                          <Users className="w-4 h-4" />
                        </div>
                      ) : (
                        <Avatar
                          src={avatarUrl}
                          alt={displayName}
                          size="md"
                          isVerified={c.other_participant?.is_verified}
                        />
                      )}
                      {c.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {displayName}
                        </p>
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {c.last_message?.text_content ||
                          (c.last_message?.shared_content
                            ? `Shared ${c.last_message.shared_content.content_type}`
                            : 'No messages yet')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT PANE */}
        <div
          className={`flex-1 flex flex-col bg-zinc-50/50 dark:bg-zinc-950/20 ${
            !activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveConversation(null)}
                    className="md:hidden p-1 text-zinc-500 hover:text-zinc-900"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <Avatar
                    src={
                      activeConversation.conversation_type === 'direct'
                        ? activeConversation.other_participant?.avatar
                        : activeConversation.image_url
                    }
                    alt={activeConversation.title || 'Chat'}
                    size="sm"
                    isVerified={activeConversation.other_participant?.is_verified}
                  />

                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {activeConversation.title ||
                        activeConversation.other_participant?.name ||
                        'Chat'}
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      {activeConversation.conversation_type === 'group'
                        ? `${activeConversation.participants.length} participants`
                        : `@${activeConversation.other_participant?.username || ''}`}
                    </p>
                  </div>
                </div>

                {activeConversation.conversation_type === 'direct' && (
                  <button
                    onClick={handleBlockUser}
                    className="text-zinc-400 hover:text-rose-500 p-1.5 transition-colors rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Block User"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Messages Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {isLoadingMessages ? (
                  <div className="py-12 text-center">
                    <Sparkles className="w-5 h-5 text-zinc-400 animate-spin mx-auto mb-1" />
                    <p className="text-xs text-zinc-500">Loading conversation history...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-xs text-zinc-400">No messages in this chat yet.</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Say hello to kick things off!</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = currentUser && m.sender.id === currentUser.id;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-end gap-1.5 max-w-[80%] sm:max-w-[70%]">
                          {!isMe && (
                            <Avatar
                              src={m.sender.avatar}
                              alt={m.sender.name}
                              size="xs"
                              className="mb-1 flex-shrink-0"
                            />
                          )}

                          <div
                            className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed space-y-2 ${
                              isMe
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-none'
                                : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 rounded-bl-none shadow-sm'
                            }`}
                          >
                            {/* Shared Content Card */}
                            {m.shared_content && (
                              <div
                                className={`p-2.5 rounded-lg border text-left ${
                                  isMe
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200 dark:bg-zinc-200 dark:border-zinc-300 dark:text-zinc-800'
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-800 dark:bg-zinc-700/60 dark:border-zinc-600 dark:text-zinc-100'
                                }`}
                              >
                                {m.shared_content.image_url && (
                                  <img
                                    src={m.shared_content.image_url}
                                    alt="Shared Preview"
                                    className="w-full h-28 object-cover rounded mb-1.5"
                                  />
                                )}
                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 block">
                                  {m.shared_content.content_type.toUpperCase()} INSPIRATION
                                </span>
                                <p className="font-semibold text-xs line-clamp-2 mt-0.5">
                                  {m.shared_content.title_or_caption}
                                </p>
                              </div>
                            )}

                            {m.text_content && <p className="whitespace-pre-line">{m.text_content}</p>}
                          </div>
                        </div>

                        <span className="text-[9px] text-zinc-400 mt-1 px-1">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={isSending || !messageText.trim()}
                  className="rounded-full w-9 h-9 p-0 flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Select a conversation
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Choose a chat from the left or start a new direct message or fashion circle.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsNewChatModalOpen(true)}
                className="mt-4"
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                New Conversation
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* NEW CHAT MODAL */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        title="Start Conversation"
        subtitle="Chat 1-on-1 or create a fashion circle group"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setNewChatType('direct')}
              className={`flex-1 pb-2 text-xs font-bold transition-all ${
                newChatType === 'direct'
                  ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100'
                  : 'text-zinc-500'
              }`}
            >
              Direct Message
            </button>
            <button
              onClick={() => setNewChatType('group')}
              className={`flex-1 pb-2 text-xs font-bold transition-all ${
                newChatType === 'group'
                  ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100'
                  : 'text-zinc-500'
              }`}
            >
              Group Circle
            </button>
          </div>

          {newChatType === 'group' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Circle Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Winter Aesthetic Squad"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              {newChatType === 'direct' ? 'Find Tastemaker' : 'Add Members'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search username or name..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* User Results List */}
          <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {isSearchingUsers ? (
              <p className="text-center text-xs text-zinc-400 py-4">Searching users...</p>
            ) : userSearchResults.length === 0 ? (
              <p className="text-center text-xs text-zinc-400 py-4">
                {userSearchQuery ? 'No users found' : 'Type to search for friends'}
              </p>
            ) : (
              userSearchResults.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      if (newChatType === 'direct') {
                        handleCreateDirectChat(u.id);
                      } else {
                        setSelectedUserIds((prev) =>
                          prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        );
                      }
                    }}
                    className="p-2 flex items-center justify-between rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatar} alt={u.displayName} size="sm" isVerified={u.isVerified} />
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {u.displayName}
                        </p>
                        <p className="text-[10px] text-zinc-400">@{u.username}</p>
                      </div>
                    </div>

                    {newChatType === 'group' && (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {newChatType === 'group' && (
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateGroupChat}
              disabled={!groupTitle.trim() || selectedUserIds.length === 0}
              className="w-full text-xs min-h-[38px] mt-2"
            >
              Create Fashion Circle ({selectedUserIds.length} added)
            </Button>
          )}
        </div>
      </Modal>
    </AppShell>
  );
};
