import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: env.openaiEmbeddingModel,
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: env.openaiEmbeddingModel,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export async function generateChatCompletion(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: env.openaiChatModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content || 'I could not generate an answer.';
}
