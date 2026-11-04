/**
 * NetMentor AI Tutor Drawer
 * 
 * Provides interactive, persistent multi-conversation AI tutoring:
 * - Markdown rendering for headings, lists, tables, and copyable code blocks
 * - Accurate live-versus-simulated provider status reporting
 * - Persistent conversation history in PostgreSQL (New Chat, Resume, Rename, Delete)
 * - Strict context isolation between general networking and lesson-grounded inquiries
 * - Mobile responsive design with smooth drawer slide-over
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  Bot,
  Sparkles,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Compass,
  Plus,
  History,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  MessageSquare,
  Layers,
} from 'lucide-react';
import {
  aiApi,
  formatProviderLabel,
  type AiTutorRequestPayload,
  type AiConversationSummary,
} from '../../lib/api.js';
import type { AiTutoringMode } from '../../../api/_lib/ai/types.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { MarkdownView } from '../ui/MarkdownView.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  isSimulated?: boolean;
}

export interface AiTutorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId?: string;
  lessonTitle?: string;
  sections?: Array<{ id: string; title: string }>;
  activeSectionId?: string;
  activeExerciseId?: string;
  initialMode?: AiTutoringMode;
  onCreateLesson?: (topic: string, context?: string, conversationId?: string) => void;
  onGenerateFlashcards?: (lessonId: string) => void;
  onGenerateStandaloneFlashcards?: (topic: string) => void;
}

export const AiTutorDrawer: React.FC<AiTutorDrawerProps> = ({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  sections = [],
  activeSectionId,
  activeExerciseId,
  initialMode,
  onCreateLesson,
  onGenerateFlashcards,
  onGenerateStandaloneFlashcards,
}) => {
  const effectiveInitialMode: AiTutoringMode = initialMode ?? (lessonId ? 'lesson_qa' : 'general_qa');
  
  // Conversation state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState<string>('');

  // Active chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<AiTutorRequestPayload | null>(null);
  const [mode, setMode] = useState<AiTutoringMode>(effectiveInitialMode);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(activeSectionId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const getWelcomeContent = (title?: string | null) => {
    if (title) {
      return `Welcome! I am your NetMentor **AI Tutor**.\n\nI can explain networking protocol mechanisms from **${title}**, or provide progressive Socratic guidance for exercises. Ask any question below to get started!`;
    }
    return `Welcome! I am your NetMentor **AI Tutor**.\n\nAsk me any networking questions across CCNA and CCNP Enterprise topics (routing, switching, network security, automation, and protocols). How can I assist your networking studies today?`;
  };

  const handleCreateLessonFromMessage = (assistantContent: string) => {
    if (!onCreateLesson) return;
    const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user');
    let inferred = 'Networking Architecture';

    const headingMatch = assistantContent.match(/^###?\s+([^#\n\r]+)/m);
    if (headingMatch && headingMatch[1].trim()) {
      inferred = headingMatch[1]
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim();
    } else if (lastUserTurn?.content) {
      const clean = lastUserTurn.content
        .replace(/^what is (the |an? )?/i, '')
        .replace(/^how (do|does|can) (i |we )?/i, '')
        .replace(/^explain (the )?/i, '')
        .replace(/^tell me about /i, '')
        .trim();
      if (clean.length > 3 && clean.length < 80) {
        inferred = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    } else if (lessonTitle) {
      inferred = lessonTitle;
    }

    onCreateLesson(inferred, assistantContent, activeConversationId || undefined);
  };

  const handleCreateFlashcardsFromMessage = (assistantContent: string) => {
    if (!onGenerateStandaloneFlashcards) return;
    const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user');
    let inferred = 'Networking Architecture';

    const headingMatch = assistantContent.match(/^###?\s+([^#\n\r]+)/m);
    if (headingMatch && headingMatch[1].trim()) {
      inferred = headingMatch[1].trim();
    } else if (lastUserTurn && lastUserTurn.content.trim()) {
      const clean = lastUserTurn.content.replace(/^(what is|explain|how does|why does|tell me about)\s+/i, '').replace(/[?.!]+$/, '').trim();
      if (clean) {
        inferred = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    } else if (lessonTitle) {
      inferred = lessonTitle;
    }

    onGenerateStandaloneFlashcards(inferred);
  };

  // Sync mode and section when props change
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else {
      setMode(lessonId ? 'lesson_qa' : 'general_qa');
    }
    if (activeSectionId) {
      setSelectedSectionId(activeSectionId);
    }
  }, [initialMode, activeSectionId, lessonId]);

  // Load conversation list when drawer opens
  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await aiApi.listConversations();
      if (res.status === 200 && res.data?.success) {
        setConversations(res.data.conversations || []);
      }
    } catch {
      // Gracefully ignore network errors on history fetch
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Set initial welcome message if no messages exist
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          content: getWelcomeContent(lessonTitle),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSimulated: true,
        },
      ]);
    }
  }, [isOpen, lessonTitle, messages.length]);

  // Focus input on drawer open, restore focus on close
  useEffect(() => {
    if (isOpen && !showHistory) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isOpen && previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.();
      previousActiveElementRef.current = null;
    }
  }, [isOpen, showHistory]);

  // Close drawer or close history view on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistory) {
          setShowHistory(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showHistory, onClose]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (!showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, showHistory]);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Start a fresh new chat session
  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveConversationTitle(null);
    setMode(lessonId ? 'lesson_qa' : 'general_qa');
    setMessages([
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: getWelcomeContent(lessonTitle),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSimulated: true,
      },
    ]);
    setError(null);
    setRetryPayload(null);
    setShowHistory(false);
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Load an existing conversation
  const handleSelectConversation = async (convId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiApi.getConversation(convId);
      if (res.status === 200 && res.data?.success) {
        const conv = res.data.conversation;
        setActiveConversationId(conv.id);
        setActiveConversationTitle(conv.title);
        setMode(conv.mode as AiTutoringMode);
        
        const loadedMessages: ChatMessage[] = res.data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model || undefined,
          isSimulated: m.isSimulated,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));

        setMessages(
          loadedMessages.length > 0
            ? loadedMessages
            : [
                {
                  id: 'welcome-msg',
                  role: 'assistant',
                  content: getWelcomeContent(conv.title),
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isSimulated: true,
                },
              ]
        );
        setShowHistory(false);
      } else {
        setError(res.message || 'Failed to load conversation.');
      }
    } catch {
      setError('Network failure loading conversation history.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;

    try {
      const res = await aiApi.deleteConversation(convId);
      if (res.status === 200 && res.data?.success) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConversationId === convId) {
          handleNewChat();
        }
      }
    } catch {
      setError('Failed to delete conversation.');
    }
  };

  // Rename a conversation
  const handleStartRename = (e: React.MouseEvent, conv: AiConversationSummary) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenamingTitle(conv.title);
  };

  const handleSaveRename = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const cleanTitle = renamingTitle.trim();
    if (!cleanTitle) {
      setRenamingId(null);
      return;
    }

    try {
      const res = await aiApi.renameConversation(convId, cleanTitle);
      if (res.status === 200 && res.data?.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: cleanTitle } : c))
        );
        if (activeConversationId === convId) {
          setActiveConversationTitle(cleanTitle);
        }
      }
    } catch {
      setError('Failed to rename conversation.');
    } finally {
      setRenamingId(null);
    }
  };

  const handleSendMessage = async (queryToSend?: string) => {
    const rawQuery = (queryToSend !== undefined ? queryToSend : inputValue).trim();
    if (!rawQuery || loading) return;

    if (rawQuery.length > 600) {
      setError('Query exceeds maximum permitted length of 600 characters.');
      return;
    }

    // Immediately reflect user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: rawQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setLoading(true);

    // Prepare bounded conversation history
    const historyTurns = messages
      .filter((m) => m.id !== 'welcome-msg')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    const payload: AiTutorRequestPayload = {
      conversationId: activeConversationId || undefined,
      lessonId: mode === 'general_qa' ? undefined : (lessonId || undefined),
      sectionId: mode === 'general_qa' ? undefined : (selectedSectionId || undefined),
      exerciseId: mode === 'socratic_hint' ? activeExerciseId : undefined,
      query: rawQuery,
      mode,
      history: historyTurns,
    };

    setRetryPayload(payload);

    try {
      const response = await aiApi.askTutor(payload);

      if (response.status === 200 && response.data?.success) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: response.data.model,
          isSimulated: response.data.isSimulated,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setRetryPayload(null);

        // Update active conversation ID if newly created on backend
        if (response.data.conversationId) {
          setActiveConversationId(response.data.conversationId);
          loadConversations();
        }
      } else {
        // Preserve typed query on failure for retry
        setInputValue(rawQuery);

        if (response.status === 401) {
          setError('Your session has expired. Please log in again to continue using the AI tutor.');
        } else if (response.status === 429) {
          const retrySec = response.retryAfterSeconds || 60;
          setError(`Rate limit reached (20 requests per hour). Please wait ${retrySec} seconds before sending another message.`);
        } else {
          setError(response.message || 'The AI tutor service encountered an error. Please click retry.');
        }
      }
    } catch {
      setInputValue(rawQuery);
      setError('Network connection failure. Please check your connectivity and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetry = () => {
    if (retryPayload) {
      handleSendMessage(retryPayload.query);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NetMentor AI Tutor Panel"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:w-[480px] md:w-[540px] h-full bg-surface-elevated/95 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 ease-out">
        {/* Header with Navigation Controls */}
        <div className="p-3.5 border-b border-white/[0.08] bg-surface-subtle/80 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {showHistory ? (
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-1 text-xs"
                aria-label="Back to chat"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="font-medium">Back</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white heading-title truncate">
                  {showHistory
                    ? 'Chat History'
                    : activeConversationTitle || 'NetMentor AI Tutor'}
                </h3>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {showHistory
                  ? `${conversations.length} saved conversations`
                  : lessonTitle || 'Global Networking Mentor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNewChat}
              icon={<Plus className="w-3.5 h-3.5 text-accent" />}
              className="text-[11px] h-7 px-2"
              aria-label="Start New Chat"
            >
              <span className="hidden xs:inline">New Chat</span>
            </Button>

            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 rounded-lg transition-colors press-scale text-xs ${
                showHistory
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Chat History"
              aria-label="Toggle Conversation History"
            >
              <History className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors press-scale"
              aria-label="Close AI Tutor Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- VIEW 1: CONVERSATION HISTORY PANEL --- */}
        {showHistory ? (
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-xs text-slate-400 font-medium">
              <span>Saved Conversations</span>
              <button
                type="button"
                onClick={loadConversations}
                disabled={loadingHistory}
                className="text-[11px] text-sky-400 hover:text-sky-300"
              >
                {loadingHistory ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No previous conversations found.</p>
                <Button variant="primary" size="sm" onClick={handleNewChat}>
                  Start a Conversation
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversations.map((c) => {
                  const isActive = c.id === activeConversationId;
                  const isRenaming = renamingId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => !isRenaming && handleSelectConversation(c.id)}
                      className={`group p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-accent/15 border-accent/40 text-white'
                          : 'bg-surface-subtle/50 hover:bg-surface-subtle border-white/[0.06] hover:border-white/[0.12] text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renamingTitle}
                              onChange={(e) => setRenamingTitle(e.target.value)}
                              className="bg-black/40 border border-accent text-white text-xs px-2 py-0.5 rounded flex-1 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(e, c.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              title="Save title"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(null);
                              }}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs truncate">{c.title}</span>
                              {isActive && (
                                <Badge variant="blue" size="sm" className="text-[9px] py-0 px-1">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                              <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="uppercase text-[9px]">
                                {c.mode === 'general_qa' ? 'General' : c.mode === 'socratic_hint' ? 'Socratic' : 'Lesson'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {!isRenaming && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(e, c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
                            title="Rename"
                            aria-label={`Rename ${c.title}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteConversation(e, c.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Delete"
                            aria-label={`Delete ${c.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* --- VIEW 2: ACTIVE CONVERSATION PANEL --- */
          <>
            {/* Mode Selector & Optional Section Context Filter */}
            <div className="px-4 py-2 border-b border-white/[0.06] bg-canvas/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-surface-subtle p-0.5 rounded-xl border border-white/[0.06]">
                {lessonId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode('lesson_qa')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium ${
                        mode === 'lesson_qa'
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-pressed={mode === 'lesson_qa'}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Lesson Q&A</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('socratic_hint')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium ${
                        mode === 'socratic_hint'
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-pressed={mode === 'socratic_hint'}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Socratic Hint</span>
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => setMode('general_qa')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium ${
                    mode === 'general_qa'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  aria-pressed={mode === 'general_qa'}
                >
                  <Compass className="w-3 h-3" />
                  <span>General Q&A</span>
                </button>
              </div>

              {lessonId && sections.length > 0 && mode !== 'general_qa' && (
                <select
                  value={selectedSectionId || ''}
                  onChange={(e) => setSelectedSectionId(e.target.value || undefined)}
                  className="bg-surface-subtle text-slate-300 text-[11px] rounded-lg px-2 py-1 border border-white/[0.08] focus:outline-none focus:border-accent"
                  aria-label="Grounded Section Filter"
                >
                  <option value="">Entire Lesson</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Context Status Notice Banner */}
            <div className="px-4 py-1.5 bg-sky-950/40 border-b border-sky-500/20 text-[11px] text-sky-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="truncate">
                  {mode === 'general_qa'
                    ? 'General Mode • All CCNA & CCNP Topics'
                    : mode === 'socratic_hint'
                    ? 'Socratic Mode • Guided Inquiry Active'
                    : `Lesson Grounded • ${lessonTitle || 'Active Lesson'}`}
                </span>
              </span>
            </div>

            {/* Scrollable Message List */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 text-xs safe-bottom">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                const providerBadge = !isUser ? formatProviderLabel(m.model, m.isSimulated) : null;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                      <span className="font-medium text-slate-300">
                        {isUser ? 'You' : 'NetMentor AI'}
                      </span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                      {!isUser && providerBadge && (
                        <Badge
                          variant={providerBadge.variant}
                          size="sm"
                          className="ml-1 text-[9px] py-0 px-1.5 font-mono flex items-center gap-1"
                        >
                          {!providerBadge.isSimulated && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {providerBadge.label}
                        </Badge>
                      )}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl max-w-[95%] sm:max-w-[90%] leading-relaxed break-words ${
                        isUser
                          ? 'bg-accent text-white rounded-br-sm shadow-md'
                          : 'bg-surface-subtle border border-white/[0.08] text-slate-200 rounded-bl-sm w-full'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="space-y-2 max-w-full overflow-hidden">
                          <MarkdownView content={m.content} />

                          {(onCreateLesson || (lessonId && onGenerateFlashcards) || (!lessonId && onGenerateStandaloneFlashcards)) && m.id !== 'welcome' && (
                            <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[10px] text-slate-400">Actions</span>
                              <div className="flex items-center gap-2">
                                {lessonId && onGenerateFlashcards && (
                                  <button
                                    type="button"
                                    onClick={() => onGenerateFlashcards(lessonId)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-all shadow-sm"
                                    title="Generate flashcards for this lesson"
                                  >
                                    <Layers className="w-3 h-3 text-purple-400" />
                                    <span>Create Flashcards</span>
                                  </button>
                                )}
                                {!lessonId && onGenerateStandaloneFlashcards && (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateFlashcardsFromMessage(m.content)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all shadow-sm"
                                    title="Generate standalone flashcards on this topic"
                                  >
                                    <Layers className="w-3 h-3 text-accent" />
                                    <span>Create Flashcards</span>
                                  </button>
                                )}
                                {onCreateLesson && (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateLessonFromMessage(m.content)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all shadow-sm"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Create Lesson</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {loading && (
                <div className="flex flex-col items-start animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                    <span className="font-medium text-slate-300">NetMentor AI Tutor</span>
                    <span>•</span>
                    <span className="text-sky-400">Reasoning...</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface-subtle border border-white/[0.08] text-slate-400 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                    <span className="text-xs">Formulating technical networking explanation...</span>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{error}</p>
                    {retryPayload && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-200 underline hover:text-white"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Request</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-white/[0.08] bg-surface-subtle/90 space-y-2">
              <div className="relative flex items-end gap-2 bg-canvas rounded-xl border border-white/[0.12] p-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder={
                    mode === 'socratic_hint'
                      ? 'Ask for a hint on your active exercise (e.g. "What happens to the Layer 2 header?")...'
                      : mode === 'general_qa'
                      ? 'Ask any networking question (e.g. "Explain BGP route selection order", "What is STP?")...'
                      : 'Ask a question about this lesson (e.g. "Explain BGP path selection order")...'
                  }
                  className="flex-1 bg-transparent resize-none text-xs text-white placeholder-slate-500 focus:outline-none min-h-[44px]"
                  maxLength={600}
                  aria-label="Ask NetMentor AI Tutor"
                />

                <Button
                  variant="primary"
                  size="sm"
                  disabled={loading || inputValue.trim().length === 0}
                  onClick={() => handleSendMessage()}
                  icon={<Send className="w-3.5 h-3.5" />}
                  className="h-9 w-9 p-0 flex items-center justify-center rounded-lg flex-shrink-0"
                  aria-label="Send query"
                >
                  <span className="sr-only">Send</span>
                </Button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                <span>Enter to send, Shift+Enter for newline</span>
                <span className={inputValue.length > 550 ? 'text-amber-400 font-mono' : 'font-mono'}>
                  {inputValue.length}/600
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
