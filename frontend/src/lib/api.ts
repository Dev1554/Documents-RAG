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

  // Folders
  async getFolderTree() {
    return this.request<ApiResponse<FolderTreeNode[]>>('/folders/tree');
  }

  async getFolders(parentId?: string) {
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
    return this.request<ApiResponse<FolderRecord[]>>(`/folders${query}`);
  }

  async getFolderBreadcrumbs(folderId: string) {
    return this.request<ApiResponse<FolderBreadcrumb[]>>(`/folders/${folderId}/breadcrumbs`);
  }

  async createFolder(name: string, parentId?: string | null) {
    return this.request<ApiResponse<FolderRecord>>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId: parentId || null }),
    });
  }

  async renameFolder(folderId: string, name: string) {
    return this.request<ApiResponse<FolderRecord>>(`/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async moveFolder(folderId: string, parentId: string | null) {
    return this.request<ApiResponse<FolderRecord>>(`/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ parentId }),
    });
  }

  async deleteFolder(folderId: string) {
    return this.request<ApiResponse<{ message: string }>>(`/folders/${folderId}`, {
      method: 'DELETE',
    });
  }

  // Documents
  async getDashboardStats() {
    return this.request<ApiResponse<DashboardStats>>('/documents/stats');
  }

  async uploadDocument(
    file: File,
    category: string,
    tags: string,
    title?: string,
    documentType?: string,
    folderId?: string
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (tags) formData.append('tags', tags);
    if (title) formData.append('title', title);
    if (documentType) formData.append('documentType', documentType);
    if (folderId) formData.append('folderId', folderId);

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
    return this.request<
      ApiResponse<{
        document: Document;
        related: Document[];
        versions: Document[];
        folder: FolderRecord | null;
        folderBreadcrumb: FolderBreadcrumb[];
      }>
    >(`/documents/${id}`);
  }

  async getDocumentVersions(id: string) {
    return this.request<ApiResponse<Document[]>>(`/documents/${id}/versions`);
  }

  async getDocumentSummary(id: string) {
    return this.request<ApiResponse<DocumentSummary>>(`/documents/${id}/summary`);
  }

  async getDocumentAuditLogs(id: string) {
    return this.request<ApiResponse<DocumentAuditLog[]>>(`/documents/${id}/audit-logs`);
  }

  getDocumentPreviewUrl(id: string) {
    return this.buildDocumentFileUrl(id, 'preview');
  }

  getDocumentDownloadUrl(id: string) {
    return this.buildDocumentFileUrl(id, 'download');
  }

  getDocumentsBulkDownloadUrl(ids: string[]) {
    const token = this.getToken();
    const params = new URLSearchParams({ ids: ids.join(',') });
    if (token) params.set('token', token);
    return `${API_BASE}/documents/download-bulk?${params.toString()}`;
  }

  private buildDocumentFileUrl(id: string, action: 'preview' | 'download') {
    const token = this.getToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/documents/${id}/${action}${query}`;
  }

  async deleteDocument(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async updateDocumentMetadata(
    id: string,
    metadata: {
      title?: string;
      category?: string;
      folderId?: string | null;
      tags?: string | string[];
      documentType?: string;
    }
  ) {
    return this.request<ApiResponse<Document>>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(metadata),
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
    return this.request<ApiResponse<ChatHistoryItem[]>>('/chat/history?includeArchived=true');
  }

  async updateChatHistoryItem(id: string, updates: { isPinned?: boolean; isArchived?: boolean }) {
    return this.request<ApiResponse<ChatHistoryItem>>(`/chat/history/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteChatHistoryItem(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/chat/history/${id}`, {
      method: 'DELETE',
    });
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

export interface FolderRecord {
  _id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FolderBreadcrumb {
  _id: string;
  name: string;
  path: string;
}

export interface FolderTreeNode extends FolderRecord {
  documentCount: number;
  childFolderCount: number;
  children: FolderTreeNode[];
}

export interface Document {
  _id: string;
  title: string;
  documentType: string;
  uploadedBy: string;
  fileType: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  category: string;
  folderId?: string;
  tags: string[];
  versionGroupKey?: string;
  versionNumber?: number;
  versionLabel?: string;
  isLatestVersion?: boolean;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'pending_ocr';
  chunkCount: number;
  aiSummary?: string;
  extractedData?: Record<string, unknown>;
  errorMessage?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  summary: string;
  cached: boolean;
}

export interface DocumentAuditLog {
  _id: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'uploaded' | 'viewed' | 'downloaded' | 'deleted';
  documentTitle: string;
  originalName: string;
  category: string;
  documentType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
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
  pageNumber?: number;
}

export interface ChatSource {
  documentId: string;
  documentName: string;
  category: string;
  content: string;
  score: number;
  pageNumber?: number;
}

export interface ChatRequest {
  question: string;
  chatId?: string;
  category?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ChatMessageRecord {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  createdAt: string;
}

export interface ChatResponse {
  id: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  messages?: ChatMessageRecord[];
  createdAt: string;
}

export interface ChatHistoryItem {
  _id: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  messages?: ChatMessageRecord[];
  isPinned?: boolean;
  isArchived?: boolean;
  pinnedAt?: string;
  archivedAt?: string;
  createdAt: string;
}

export const api = new ApiClient();
