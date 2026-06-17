import { ChatHistory, ChatMessage, IChatHistory } from '../models/ChatHistory';
import { generateChatCompletion } from './embedding.service';
import {
  classifyChatSearchMode,
  filterChatSearchResults,
  globalAISearch,
} from './search.service';
import { ChatSource, DocumentFilters } from '../types';
import { AppError } from '../utils/AppError';

const SYSTEM_PROMPT = `You are an AI assistant for a private document management system.
Answer global search questions based ONLY on the provided document context.
If the answer is not in the context, say you don't have enough information in the documents.
Be concise and quote directly from the context when possible.
For list-style requests such as "show all", "find every", or "which documents", list each matching document separately.
For cross-document questions, synthesize across all provided sources before answering.
For specific document lookup requests such as "GST certificate", "PAN card", or "invoice for client X", answer only from directly matching documents. Do not mention loosely related documents.
For process or workflow questions such as "visa process" or "how to apply for GST", you may synthesize across all provided sources.
For "Which clients..." questions, extract client/party names from each relevant document and group by document when useful.
For expiry questions, look for expiry, expiration, valid till, renewal, end date, termination date, and similar clauses.
For amount comparisons, only include documents where the provided context supports the comparison.
Mention uncertainty if OCR or extracted text is incomplete.

When referencing facts, mention the relevant source name or page naturally when useful.
Do not invent citations. The application renders authoritative source citations separately from structured retrieval metadata.`;

function getStoredMessages(chat: IChatHistory): ChatMessage[] {
  if (chat.messages?.length) return chat.messages;

  return [
    {
      role: 'user',
      content: chat.question,
      sources: [],
      createdAt: chat.createdAt,
    },
    {
      role: 'assistant',
      content: chat.answer,
      sources: chat.sources || [],
      createdAt: chat.createdAt,
    },
  ];
}

export async function askQuestion(
  userId: string,
  question: string,
  filters: DocumentFilters = {},
  chatId?: string
) {
  const chatEntry = chatId
    ? await ChatHistory.findOne({ _id: chatId, userId, isArchived: { $ne: true } })
    : null;

  if (chatId && !chatEntry) {
    throw new AppError('Chat not found', 404);
  }

  const searchMode = classifyChatSearchMode(question);
  const searchLimit = searchMode === 'process' ? 20 : 12;
  const results = filterChatSearchResults(
    await globalAISearch(userId, question, filters, searchLimit),
    question,
    searchMode
  );

  const sources: ChatSource[] = results.map((r) => ({
    documentId: r.documentId,
    documentName: r.documentName,
    category: r.category,
    content: r.content.slice(0, 900),
    score: r.score,
    pageNumber: r.pageNumber || 1,
  }));

  let answer: string;

  if (sources.length === 0) {
    answer =
      "I couldn't find any relevant documents to answer your question. Try uploading documents or refining your search filters.";
  } else {
    const context = sources
      .map(
        (s, i) =>
          `[Source ${i + 1}: ${s.documentName} (Category: ${s.category}, Page: ${s.pageNumber || 1}, Score: ${s.score.toFixed(2)})]\n${s.content}`
      )
      .join('\n\n');

    const priorConversation = chatEntry
      ? getStoredMessages(chatEntry)
          .slice(-8)
          .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
          .join('\n')
      : '';

    const userPrompt = `${priorConversation ? `Previous conversation:\n${priorConversation}\n\n` : ''}Context from documents:\n\n${context}\n\nQuestion: ${question}`;
    answer = await generateChatCompletion(SYSTEM_PROMPT, userPrompt);
  }

  const now = new Date();
  const userMessage: ChatMessage = {
    role: 'user',
    content: question,
    sources: [],
    createdAt: now,
  };
  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: answer,
    sources,
    createdAt: now,
  };

  const savedChat =
    chatEntry ||
    new ChatHistory({
      userId,
      question,
      answer,
      sources,
      messages: [],
    });

  const existingMessages = chatEntry ? getStoredMessages(chatEntry) : [];
  savedChat.answer = answer;
  savedChat.sources = sources;
  savedChat.messages = [...existingMessages, userMessage, assistantMessage];
  await savedChat.save();

  return {
    id: savedChat._id.toString(),
    question: savedChat.question,
    answer,
    sources,
    messages: savedChat.messages,
    createdAt: savedChat.createdAt,
  };
}

export async function getChatHistory(
  userId: string,
  limit: number = 50,
  includeArchived: boolean = false
) {
  return ChatHistory.find({
    userId,
    ...(includeArchived ? {} : { isArchived: { $ne: true } }),
  })
    .sort({ isPinned: -1, pinnedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}
