const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data as T;
  }

  // Auth
  async register(name: string, email: string, password: string) {
    return this.request<ApiResponse<{ token: string; user: User }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<ApiResponse<{ token: string; user: User }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<ApiResponse<User>>('/auth/me');
  }

  // Categories
  async getCategories() {
    return this.request<ApiResponse<Category[]>>('/categories');
  }

  async createCategory(name: string) {
    return this.request<ApiResponse<Category>>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteCategory(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Documents
  async getDashboardStats() {
    return this.request<ApiResponse<DashboardStats>>('/documents/stats');
  }

  async uploadDocument(file: File, category: string, tags: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (tags) formData.append('tags', tags);

    return this.request<ApiResponse<Document>>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getDocuments(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<ApiResponse<Document[]>>(`/documents?${query}`);
  }

  async getDocument(id: string) {
    return this.request<ApiResponse<{ document: Document; related: Document[] }>>(
      `/documents/${id}`
    );
  }

  async deleteDocument(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // Search
  async search(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.request<ApiResponse<SearchResult[]>>(`/search?${query}`);
  }

  // Chat
  async askQuestion(payload: ChatRequest) {
    return this.request<ApiResponse<ChatResponse>>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getChatHistory() {
    return this.request<ApiResponse<ChatHistoryItem[]>>('/chat/history');
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

export interface Document {
  _id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  category: string;
  tags: string[];
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'pending_ocr';
  chunkCount: number;
  errorMessage?: string;
  uploadedAt: string;
  createdAt: string;
}

export interface DashboardStats {
  totalDocuments: number;
  readyDocuments: number;
  pendingDocuments: number;
  categoryCount: number;
  recentDocuments: Document[];
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  category: string;
  tags: string[];
  content: string;
  score: number;
  chunkIndex: number;
}

export interface ChatSource {
  documentId: string;
  documentName: string;
  category: string;
  content: string;
  score: number;
}

export interface ChatRequest {
  question: string;
  category?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatResponse {
  id: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  createdAt: string;
}

export interface ChatHistoryItem {
  _id: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  createdAt: string;
}

export const api = new ApiClient();
