import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Filter,
  MessageSquare,
  Send,
  Brain,
  Database,
  ArrowUpRight,
  Menu,
  X,
  History,
  Plus,
  Compass,
  FileText,
  Shield,
  DollarSign,
  Calendar,
  Download,
  Archive,
  Pin,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Category, ChatHistoryItem, ChatResponse } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatResponse['sources'];
}

interface ParsedMessage {
  mainContent: string;
}

const parseMessageContent = (text: string): ParsedMessage => {
  const citationRegex = /Source:\s*\n*([^\n]+)\s*\n+\s*Page:\s*(\d+)/gi;
  let mainContent = text.replace(citationRegex, '').trim();
  const cleanupRegex = /Never trust AI answers without source references\.?/gi;
  mainContent = mainContent.replace(cleanupRegex, '').trim();
  
  return {
    mainContent
  };
};

function getUniqueSourceDocumentIds(sources: ChatResponse['sources'] = []) {
  return Array.from(new Set(sources.map((source) => source.documentId)));
}

function historyItemToMessages(item: ChatHistoryItem): Message[] {
  if (item.messages?.length) {
    return item.messages.map((message, index) => ({
      id: `${item._id}-${index}`,
      role: message.role,
      content: message.content,
      sources: message.sources,
    }));
  }

  return [
    { id: `${item._id}-q`, role: 'user', content: item.question },
    {
      id: `${item._id}-a`,
      role: 'assistant',
      content: item.answer,
      sources: item.sources,
    },
  ];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyItems, setHistoryItems] = useState<ChatHistoryItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState<{ msgId: string; srcIdx: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadContainerRef = useRef<HTMLDivElement>(null);

  const loadSidebarHistory = async () => {
    const res = await api.getChatHistory();
    setHistoryItems(res.data);
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setActiveSourceIndex(null);
  };

  const openChat = (item: ChatHistoryItem) => {
    setActiveChatId(item._id);
    setMessages(historyItemToMessages(item));
    setActiveSourceIndex(null);
    setInput('');
  };

  useEffect(() => {
    api.getCategories().then((res) => setCategories(res.data));
    loadSidebarHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submitQuestion = async (question: string) => {
    if (!question.trim() || loading) return;

    const currentChatId = activeChatId;
    const pendingUserId = `pending-${Date.now()}`;
    setActiveSourceIndex(null);
    setMessages((prev) =>
      currentChatId ? [...prev, { id: pendingUserId, role: 'user', content: question }] : [{ id: pendingUserId, role: 'user', content: question }]
    );
    setLoading(true);

    try {
      const payload: {
        question: string;
        chatId?: string;
        category?: string;
        dateFrom?: string;
        dateTo?: string;
      } = { question };
      if (currentChatId) payload.chatId = currentChatId;
      if (category) payload.category = category;
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;

      const res = await api.askQuestion(payload);

      const newChatItem: ChatHistoryItem = {
        _id: res.data.id,
        question: res.data.question,
        answer: res.data.answer,
        sources: res.data.sources,
        messages: res.data.messages,
        createdAt: res.data.createdAt,
      };

      setActiveChatId(res.data.id);
      setMessages(historyItemToMessages(newChatItem));
      await loadSidebarHistory();
    } catch (err) {
      setMessages((prev) => [
        ...(currentChatId ? prev : [{ id: pendingUserId, role: 'user' as const, content: question }]),
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Failed to get answer',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput('');
    await submitQuestion(question);
  };

  const handleSuggestionClick = async (queryText: string) => {
    setInput('');
    await submitQuestion(queryText);
  };

  const handleUpdateChatHistoryItem = async (
    itemId: string,
    updates: { isPinned?: boolean; isArchived?: boolean }
  ) => {
    const res = await api.updateChatHistoryItem(itemId, updates);
    setHistoryItems((prev) =>
      prev
        .map((item) => (item._id === itemId ? res.data : item))
        .sort((a, b) => {
          const pinnedDelta = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
          if (pinnedDelta !== 0) return pinnedDelta;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
    );

    if (updates.isArchived && activeChatId === itemId) {
      startNewChat();
    } else if (activeChatId === itemId) {
      setMessages(historyItemToMessages(res.data));
    }
  };

  const handleDeleteChatHistoryItem = async (itemId: string) => {
    if (!window.confirm('Delete this chat from history?')) return;

    await api.deleteChatHistoryItem(itemId);
    setHistoryItems((prev) => prev.filter((item) => item._id !== itemId));
    if (activeChatId === itemId) {
      startNewChat();
    }
  };

  const suggestions = [
    {
      title: 'Signed NDAs',
      desc: 'Find clients who have signed NDA documents',
      query: 'Which clients have signed NDAs?',
      icon: FileText,
      color: 'text-cyan-500 bg-cyan-500/10 dark:border-cyan-500/20',
    },
    {
      title: 'OpenAI Mentions',
      desc: 'Find every document that mentions OpenAI',
      query: 'Find every document mentioning OpenAI',
      icon: Shield,
      color: 'text-emerald-500 bg-emerald-500/10 dark:border-emerald-500/20',
    },
    {
      title: 'Expiring Contracts',
      desc: 'Find contracts expiring in the current year',
      query: 'Show all contracts expiring this year',
      icon: DollarSign,
      color: 'text-amber-500 bg-amber-500/10 dark:border-amber-500/20',
    },
    {
      title: 'Monthly Summary',
      desc: 'Summarize recently ingested database records',
      query: 'Summarize documents uploaded this month',
      icon: Calendar,
      color: 'text-teal-500 bg-teal-500/10 dark:border-teal-500/20',
    },
  ];

  // Plain-text parser for styled markdown outputs (paragraphs, bold, code blocks, lists)
  const parseMarkdown = (text: string) => {
    const blocks = text.split('\n\n');
    return blocks.map((block, idx) => {
      // Code blocks
      if (block.startsWith('```')) {
        const cleanCode = block.replace(/```[a-zA-Z]*/, '').replace(/```$/, '');
        return (
          <pre key={idx} className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-white/5 dark:bg-slate-950 text-blue-600 dark:text-teal-400">
            <code>{cleanCode}</code>
          </pre>
        );
      }

      // Bullet lists
      if (block.startsWith('- ') || block.startsWith('* ')) {
        const items = block.split(/\n[-*]\s+/).map((item) => item.replace(/^[-*]\s+/, ''));
        return (
          <ul key={idx} className="my-2 list-disc pl-5 space-y-1.5 text-slate-700 dark:text-slate-300">
            {items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      }

      // Numbered lists
      if (/^\d+\.\s+/.test(block)) {
        const items = block.split(/\n\d+\.\s+/).map((item) => item.replace(/^\d+\.\s+/, ''));
        return (
          <ol key={idx} className="my-2 list-decimal pl-5 space-y-1.5 text-slate-700 dark:text-slate-300">
            {items.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        );
      }

      // Standard text with bold processing
      return (
        <p key={idx} className="leading-7 mb-3 text-slate-700 dark:text-slate-300">
          {block.split('**').map((chunk, i) => 
            i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-900 dark:text-white">{chunk}</strong> : chunk
          )}
        </p>
      );
    });
  };

  const recentHistoryItems = historyItems.filter((item) => !item.isArchived);
  const archivedHistoryItems = historyItems.filter((item) => item.isArchived);

  return (
    <div className="flex h-screen relative -mx-4 -my-20 lg:-mx-8 lg:-my-8 overflow-hidden bg-slate-50 dark:bg-[#060a13]">
      
      {/* LEFT SIDEBAR - Collapsible Chat History */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <>
            {/* Mobile Chat Sidebar Backdrop */}
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm dark:bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring' as const, damping: 25, stiffness: 200 }}
              className="fixed lg:relative inset-y-0 left-0 z-50 h-full flex flex-col border-r border-slate-200/80 bg-white/95 dark:bg-slate-950/95 lg:bg-white/70 lg:dark:bg-slate-950/20 backdrop-blur-xl shadow-xl lg:shadow-none"
            >
            {/* Sidebar header */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5">
              <button
                onClick={startNewChat}
                className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-white transition-all active:scale-95"
              >
                <Plus className="h-4 w-4 text-blue-600 dark:text-teal-400" />
                New Chat
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable History List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Recent Queries
                </span>
                {recentHistoryItems.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-400 italic">No past queries indexed</p>
                ) : (
                  <div className="pt-2 space-y-1">
                    {recentHistoryItems.map((item) => (
                      <div
                        key={item._id}
                        className={`group/history flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs transition-colors ${
                          activeChatId === item._id
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <button
                          onClick={() => openChat(item)}
                          className="min-w-0 flex flex-1 items-center gap-2 py-1 text-left"
                        >
                          {item.isPinned ? (
                            <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          )}
                          <span className="truncate">{item.question}</span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover/history:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleUpdateChatHistoryItem(item._id, { isPinned: !item.isPinned })}
                            className={`rounded-lg p-1 hover:bg-white dark:hover:bg-slate-800 ${item.isPinned ? 'text-amber-500' : 'text-slate-400'}`}
                            title={item.isPinned ? 'Unpin chat' : 'Pin chat'}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateChatHistoryItem(item._id, { isArchived: true })}
                            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                            title="Archive chat"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChatHistoryItem(item._id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {archivedHistoryItems.length > 0 && (
                <div className="space-y-1">
                  <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" />
                    Archived
                  </span>
                  <div className="pt-2 space-y-1">
                    {archivedHistoryItems.map((item) => (
                      <div
                        key={item._id}
                        className={`group/history flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs transition-colors ${
                          activeChatId === item._id
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            : 'text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                        }`}
                      >
                        <button
                          onClick={() => openChat(item)}
                          className="min-w-0 flex flex-1 items-center gap-2 py-1 text-left"
                        >
                          <Archive className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.question}</span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover/history:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleUpdateChatHistoryItem(item._id, { isArchived: false })}
                            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                            title="Restore chat"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChatHistoryItem(item._id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User widget */}
            <div className="p-4 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold text-xs uppercase">
                <Brain className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cognitive Engine</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">RAG Integration v1.0</p>
              </div>
            </div>
          </motion.aside>
        </>
        )}
      </AnimatePresence>

      {/* Main Conversation Stream */}
      <section className="flex-1 flex flex-col relative h-full">
        {/* Toggle sidebar floating trigger */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 lg:top-4 top-16 z-10 p-2.5 rounded-xl border border-slate-200 bg-white/80 dark:border-white/5 dark:bg-slate-900/80 backdrop-blur-md shadow-sm text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        {/* Conversation flow viewport */}
        <div 
          ref={threadContainerRef}
          className="flex-1 overflow-y-auto px-4 pt-16 pb-36 scroll-smooth"
        >
          {messages.length === 0 ? (
            /* Gemini-style startup prompt screen */
            <div className="max-w-2xl mx-auto min-h-full flex flex-col justify-center items-center text-center space-y-8 px-4 py-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20"
              >
                <Brain className="h-8 w-8 animate-float-slow" />
              </motion.div>

              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Global AI Search
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Ask questions across all documents. I retrieve relevant chunks from the vault and synthesize an answer with citations.
                </p>
              </div>

              {/* Suggestions Header */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-6 w-full max-w-2xl text-left">
                <Compass className="h-4.5 w-4.5 text-blue-500 animate-spin-slow shrink-0" />
                <span>Try asking:</span>
              </div>

              {/* Suggestions Grid */}
              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                {suggestions.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.button
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ y: -2, transition: { duration: 0.1 } }}
                      key={s.title}
                      onClick={() => handleSuggestionClick(s.query)}
                      className="group relative rounded-2xl border border-slate-200 bg-white/70 p-5 text-left dark:border-white/5 dark:bg-slate-950/40 shadow-sm flex flex-col justify-between hover:border-blue-500/30 hover:shadow-glow-brand hover:bg-blue-500/5 dark:hover:border-blue-500/20 transition-all duration-300 h-28 active:scale-95"
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-teal-400 transition-colors">
                          {s.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal pr-6">
                          {s.desc}
                        </p>
                      </div>
                      
                      <div className={`absolute bottom-4 right-4 rounded-xl p-2 border shrink-0 transition-transform group-hover:scale-105 ${s.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Wide Open Stream - ChatGPT style */
            <div className="max-w-3xl mx-auto space-y-10 px-2 sm:px-6">
              {messages.map((msg) => {
                const isAI = msg.role === 'assistant';

                return (
                  <div
                    key={msg.id}
                    id={msg.id}
                    className={`group flex items-start gap-4 rounded-2xl p-4 transition-colors ${
                      isAI 
                        ? 'justify-start' 
                        : 'justify-end'
                    }`}
                  >
                    {/* Bot Avatar Left */}
                    {isAI && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}

                    {/* Message Details */}
                    <div className={`min-w-0 flex-1 space-y-2 ${isAI ? '' : 'flex flex-col items-end'}`}>
                      {/* Avatar descriptor */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                          {isAI ? 'Assistant' : 'User'}
                        </span>
                        {isAI && msg.sources && msg.sources.length > 0 && (
                          <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.2 rounded-full uppercase">
                            RAG Cited
                          </span>
                        )}
                      </div>

                      {/* Content Bubble */}
                      {isAI ? (
                        /* Plain text rendering for AI to look clean and un-boxed like ChatGPT */
                        <div className="text-sm leading-7 pr-4 space-y-4">
                          <div>
                            {(() => {
                              const parsed = parseMessageContent(msg.content);
                              const uniqueSourceIds = getUniqueSourceDocumentIds(msg.sources);
                              return (
                                <>
                                  {parseMarkdown(parsed.mainContent)}
                                  
                                  {/* Verified citations come from structured RAG sources, not model text. */}
                                  {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-4 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 dark:border-emerald-500/10 dark:bg-emerald-950/10 backdrop-blur-md space-y-3 max-w-xl">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                          <Shield className="h-4 w-4 shrink-0 text-emerald-500 animate-pulse" />
                                          <span>Verified Source Documents</span>
                                        </div>
                                        {uniqueSourceIds.length > 1 && (
                                          <a
                                            href={api.getDocumentsBulkDownloadUrl(uniqueSourceIds)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                            download
                                          >
                                            <Download className="h-3.5 w-3.5" />
                                            Download all
                                          </a>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        {msg.sources.map((source, cIdx) => (
                                          <div
                                            key={`${source.documentId}-${source.pageNumber || 1}-${cIdx}`}
                                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white/70 dark:border-white/5 dark:bg-slate-900/40 hover:scale-[1.01] hover:bg-white dark:hover:bg-slate-900/80 transition-all duration-200 shadow-sm"
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                <FileText className="h-4 w-4" />
                                              </div>
                                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                                                {source.documentName}
                                              </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 shrink-0">
                                              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                                                Page {source.pageNumber || 1}
                                              </span>
                                              <Link
                                                to={`/documents/${source.documentId}`}
                                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400"
                                                title="Open document"
                                              >
                                                <ArrowUpRight className="h-4 w-4" />
                                              </Link>
                                              <a
                                                href={api.getDocumentDownloadUrl(source.documentId)}
                                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                                                title="Download document"
                                                download
                                              >
                                                <Download className="h-4 w-4" />
                                              </a>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        /* Clean right-aligned capsule for User message */
                        <div className="rounded-2xl rounded-tr-none border border-blue-100/50 bg-blue-50/30 dark:border-blue-500/10 dark:bg-blue-950/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 shadow-sm max-w-[90%]">
                          {msg.content}
                        </div>
                      )}

                      {/* Source Chips - Gemini style */}
                      {isAI && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-4 space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            Citations
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, sIdx) => {
                              const isActive = activeSourceIndex?.msgId === msg.id && activeSourceIndex?.srcIdx === sIdx;
                              
                              return (
                                <div key={`${source.documentId}-${sIdx}`} className="relative">
                                  <button
                                    onClick={() => setActiveSourceIndex(isActive ? null : { msgId: msg.id, srcIdx: sIdx })}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                                      isActive
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/80 dark:bg-slate-950/40 dark:hover:bg-slate-900/60 dark:text-slate-300 dark:border-white/5'
                                    }`}
                                  >
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="max-w-[120px] truncate">{source.documentName}</span>
                                    <span className="text-[9px] font-medium text-slate-400">p. {source.pageNumber || 1}</span>
                                    <span className="text-[9px] opacity-70">{(source.score * 100).toFixed(0)}%</span>
                                  </button>

                                  {/* Expandable citation drawer */}
                                  <AnimatePresence>
                                    {isActive && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute left-0 bottom-full mb-2 z-30 w-72 p-4 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/5 dark:bg-slate-950/95 backdrop-blur-xl text-xs space-y-2"
                                      >
                                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                                          <span className="font-bold text-slate-900 dark:text-white truncate pr-2">{source.documentName}</span>
                                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">Page {source.pageNumber || 1}</span>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 italic leading-relaxed">
                                          "{source.content}"
                                        </p>
                                        <div className="flex items-center gap-3 pt-1">
                                          <Link
                                            to={`/documents/${source.documentId}`}
                                            className="text-[10px] font-bold text-blue-600 hover:underline uppercase flex items-center gap-1"
                                          >
                                            Open document
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                          </Link>
                                          <a
                                            href={api.getDocumentDownloadUrl(source.documentId)}
                                            className="text-[10px] font-bold text-emerald-600 hover:underline uppercase flex items-center gap-1"
                                            download
                                          >
                                            Download
                                            <Download className="h-3.5 w-3.5" />
                                          </a>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Thinking loader state */}
              {loading && (
                <div className="flex gap-4 p-4 rounded-2xl justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Assistant
                    </span>
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium py-1">
                      <Database className="h-3.5 w-3.5 animate-pulse" />
                      <span>Retrieving vectors & parsing response...</span>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500/60" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500/60" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500/60" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* FLOATING PILL INPUT Capsule */}
        <div className="absolute bottom-0 left-0 right-0 py-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-[#060a13] dark:via-[#060a13]/90 pointer-events-none">
          <div className="max-w-3xl mx-auto w-full px-4 pointer-events-auto relative">
            
            {/* Toggleable Context Filter Popover */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.98 }}
                  className="absolute bottom-full left-4 right-4 mb-3 p-5 rounded-3xl border border-slate-200 bg-white/90 shadow-2xl dark:border-white/5 dark:bg-slate-950/90 backdrop-blur-xl grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category Context</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input-field py-2"
                    >
                      <option value="">All categories</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat.name} className="dark:bg-slate-950">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field py-2" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field py-2" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div className="rounded-3xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-slate-900/60 shadow-lg backdrop-blur-xl p-2.5 flex items-end gap-2 pr-3.5 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                {/* Context filter toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-2xl shrink-0 transition-colors ${
                    showFilters 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : (category || dateFrom || dateTo)
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                  title="Context Filters"
                >
                  <Filter className="h-4.5 w-4.5" />
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Search across all indexed documents..."
                  rows={1}
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-slate-950 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  disabled={loading}
                />

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 to-teal-600 text-white shadow-md shadow-blue-500/10 hover:from-blue-600 hover:to-teal-500 active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Status active details indicator */}
              {(category || dateFrom || dateTo) && !showFilters && (
                <div className="flex flex-wrap gap-1.5 px-3 mt-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {category && <span>Category: {category}</span>}
                  {dateFrom && <span>From: {dateFrom}</span>}
                  {dateTo && <span>To: {dateTo}</span>}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
