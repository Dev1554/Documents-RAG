import { ChatHistory } from '../models/ChatHistory';
import { generateChatCompletion } from './embedding.service';
import { hybridSearch } from './search.service';
import { ChatSource, DocumentFilters } from '../types';

const SYSTEM_PROMPT = `You are an AI assistant for a private document management system.
Answer questions based ONLY on the provided document context.
If the answer is not in the context, say you don't have enough information in the documents.
Be concise and quote directly from the context when possible.

You MUST include a citation block at the very end of your response for any facts retrieved from the documents.
For each document used to generate the answer, output the citation in the following exact format:

Source:
[document_name]

Page: [page_number]

If multiple source files or pages were used, output a citation block for each one, separated by two newlines.
Never trust AI answers without source references.`;

export async function askQuestion(
  userId: string,
  question: string,
  filters: DocumentFilters = {}
) {
  const results = await hybridSearch(userId, question, filters, 8);

  const sources: ChatSource[] = results.map((r) => ({
    documentId: r.documentId,
    documentName: r.documentName,
    category: r.category,
    content: r.content.slice(0, 500),
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
          `[Source ${i + 1}: ${s.documentName} (Category: ${s.category}, Page: ${s.pageNumber || 1})]\n${s.content}`
      )
      .join('\n\n');

    const userPrompt = `Context from documents:\n\n${context}\n\nQuestion: ${question}`;
    answer = await generateChatCompletion(SYSTEM_PROMPT, userPrompt);
  }

  const chatEntry = await ChatHistory.create({
    userId,
    question,
    answer,
    sources,
  });

  return {
    id: chatEntry._id.toString(),
    question,
    answer,
    sources,
    createdAt: chatEntry.createdAt,
  };
}

export async function getChatHistory(userId: string, limit: number = 20) {
  return ChatHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
