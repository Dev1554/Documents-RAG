import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { api, Category, ChatHistoryItem, ChatResponse } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatResponse['sources'];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getCategories().then((res) => setCategories(res.data));
    api.getChatHistory().then((res) => {
      const historyMessages: Message[] = [];
      res.data.reverse().forEach((item: ChatHistoryItem) => {
        historyMessages.push({ id: `${item._id}-q`, role: 'user', content: item.question });
        historyMessages.push({
          id: `${item._id}-a`,
          role: 'assistant',
          content: item.answer,
          sources: item.sources,
        });
      });
      setMessages(historyMessages);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: question }]);
    setLoading(true);

    try {
      const payload: Record<string, string> = { question };
      if (category) payload.category = category;
      if (dateFrom) payload.dateFrom = dateFrom;
      if (dateTo) payload.dateTo = dateTo;

      const res = await api.askQuestion(
        payload as { question: string; category?: string; dateFrom?: string; dateTo?: string }
      );
      setMessages((prev) => [
        ...prev,
        {
          id: res.data.id,
          role: 'assistant',
          content: res.data.answer,
          sources: res.data.sources,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Failed to get answer',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Show GST certificate',
    'Find employee NDA',
    'What is the contract value?',
    'Summarize invoices from this month',
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950 lg:flex">
        <button
          onClick={() => {
            setMessages([]);
            setInput('');
          }}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Retrieval filters</h2>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronDown
                className={`h-4 w-4 transition ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {(showFilters || category || dateFrom || dateTo) && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Date from
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Date to
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input-field"
                />
              </div>

              <button
                onClick={() => {
                  setCategory('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Agent mode
          </h2>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            The assistant searches your vectors, reads matching chunks, answers with context, and
            links source documents.
          </p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Document Agent
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Ask questions, retrieve sources, and reason over your uploaded documents.
            </p>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary lg:hidden"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </button>
        </header>

        {showFilters && (
          <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                How can I help with your documents?
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Ask for certificates, values, clauses, dates, employee files, banking records, or
                summaries. I will search your document library and cite sources.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400 group-hover:text-brand-600 dark:text-slate-500">
                      <Search className="h-3.5 w-3.5" />
                      Try asking
                    </div>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl px-6 py-8">
              <div className="space-y-8">
                {messages.map((msg) => (
                  <div key={msg.id} className="group flex gap-4">
                    <div
                      className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        msg.role === 'assistant'
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {msg.role === 'assistant' ? 'Document Agent' : 'You'}
                        </p>
                        {msg.role === 'assistant' && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">
                            RAG
                          </span>
                        )}
                      </div>

                      <div
                        className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                          msg.role === 'assistant'
                            ? 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100'
                            : 'bg-brand-600 text-white'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <FileText className="h-3.5 w-3.5" />
                            Sources used
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {msg.sources.map((source, i) => (
                              <Link
                                key={`${source.documentId}-${i}`}
                                to={`/documents/${source.documentId}`}
                                className="rounded-xl border border-slate-200 bg-white p-3 text-xs transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                              >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                    {source.documentName}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    {(source.score * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="mb-2 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                                  {source.category}
                                </p>
                                <p className="line-clamp-2 text-slate-500 dark:text-slate-400">
                                  {source.content}
                                </p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Document Agent
                      </p>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          Searching documents and drafting answer
                        </div>
                        <div className="flex gap-1">
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Message Document Agent..."
                  rows={1}
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {(category || dateFrom || dateTo) && (
                <div className="flex flex-wrap gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {category && <span>Category: {category}</span>}
                  {dateFrom && <span>From: {dateFrom}</span>}
                  {dateTo && <span>To: {dateTo}</span>}
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              Answers are generated from retrieved document chunks. Check source documents for
              critical decisions.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
