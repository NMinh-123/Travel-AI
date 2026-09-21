import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiRequest, errorMessage } from '@client/lib/api';
import type { ChatMessage } from '@shared/types';
import { useAuth } from '@client/context/AuthContext';

/**
 * Trạng thái một phiên hội thoại với chatbot.
 *
 * Trước Vòng 5, lịch sử chat chỉ nằm trong React state nên mất sạch khi F5 và không đồng bộ giữa
 * các thiết bị — FR-BOT-07 (*Bắt buộc*) chưa đạt. Giờ server giữ lịch sử, client chỉ giữ
 * `sessionId`.
 *
 * `sessionId` nằm ở localStorage chứ không phải cookie: SRS Mục 7.2 cho khách vãng lai trò chuyện
 * mà không cần tài khoản. Mỗi tài khoản và khách có khoá lưu riêng; danh sách hội thoại
 * của tài khoản được tải từ server để truy cập được trên thiết bị khác.
 *
 * Phiên được giữ ở MỘT chỗ duy nhất: ChatSessionProvider bọc cả ứng dụng, widget nổi và tab chat
 * đầy đủ chỉ là hai khung nhìn của cùng state đó. Bản trước mỗi nơi gọi hook riêng nên mỗi nơi
 * giữ một `sessionId` độc lập: khách hỏi ở tab rồi mở widget là widget mở phiên mới và ghi đè
 * localStorage, mất toàn bộ hội thoại cũ sau khi tải lại trang.
 */
const SESSION_KEY = 'travel_ai_chat_session';

function readStoredSession(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư): phiên vẫn chạy được, chỉ là không nhận
    // lại được sau khi tải lại trang.
    return null;
  }
}

function storeSession(key: string, id: string): void {
  try {
    window.localStorage.setItem(key, id);
  } catch {
    /* không lưu được thì thôi, không phải lỗi chặn luồng */
  }
}

function clearStoredSession(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* cùng lý do với storeSession: không xoá được cũng không phải lỗi chặn luồng */
  }
}

interface ChatResponse {
  sessionId: string;
  reply: string;
  suggestions: string[];
  agent: string;
  escalated: boolean;
}

interface SessionResponse {
  sessionId: string;
  escalated: boolean;
  satisfaction: number | null;
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    suggestions: string[];
    timestamp: string;
  }[];
}

function clockOf(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export interface ChatSession {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  historyLoading: boolean;
  historyError: string | null;
  sessionError: string | null;
  hasMoreHistory: boolean;
  loadHistory: (more?: boolean) => Promise<void>;
  openSession: (id: string) => Promise<void>;
  messages: ChatMessage[];
  isLoading: boolean;
  isRestoring: boolean;
  escalated: boolean;
  satisfaction: number | null;
  send: (text: string) => Promise<void>;
  rate: (value: 1 | -1) => Promise<void>;
  reset: () => void;
}

interface SessionSummary {
  id: string;
  title: string;
  lastActiveAt: string;
}

function useSharedChatSession(userId: string | null): ChatSession {
  const storageKey = `${SESSION_KEY}:${userId ?? 'guest'}`;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const historyOffset = useRef<number | null>(null);
  const historyRequest = useRef(0);
  const busy = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [escalated, setEscalated] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const sessionId = useRef<string | null>(readStoredSession(storageKey));
  /** Tăng mỗi lần mở trò chuyện mới, để kết quả mạng của phiên cũ không rơi vào phiên mới. */
  const generation = useRef(0);

  // Unmount on account changes also invalidates pending send/restore responses.
  useEffect(() => () => { generation.current += 1; historyRequest.current += 1; }, []);

  const loadHistory = useCallback(async (more = false) => {
    if (!userId || (more && historyOffset.current === null)) return;
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiRequest<{ sessions: SessionSummary[]; nextOffset: number | null }>(
        `/api/chat/sessions?offset=${more ? historyOffset.current : 0}`
      );
      if (request !== historyRequest.current) return;
      setSessions((previous) => more
        ? [...previous, ...data.sessions.filter((item) => !previous.some((row) => row.id === item.id))]
        : data.sessions);
      setNextOffset(data.nextOffset);
      historyOffset.current = data.nextOffset;
    } catch (error) {
      if (request === historyRequest.current) setHistoryError(errorMessage(error, 'Không tải được lịch sử'));
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const openSession = useCallback(async (id: string) => {
    const gen = ++generation.current;
    busy.current = true;
    setIsLoading(false);
    setIsRestoring(true);
    setSessionError(null);
    setMessages([]);
    setEscalated(false);
    setSatisfaction(null);
    sessionId.current = id;
    setActiveSessionId(id);
    storeSession(storageKey, id);
    try {
      const data = await apiRequest<SessionResponse>(`/api/chat/sessions/${encodeURIComponent(id)}`);
      if (gen !== generation.current) return;
      setMessages(data.messages.map((row) => ({ ...row, timestamp: clockOf(row.timestamp) })));
      setEscalated(data.escalated);
      setSatisfaction(data.satisfaction);
    } catch (error) {
      if (gen !== generation.current) return;
      setSessionError(errorMessage(error, 'Không mở được cuộc trò chuyện'));
      if (error instanceof ApiError && error.status === 404) {
        sessionId.current = null;
        setActiveSessionId(null);
        clearStoredSession(storageKey);
      }
    } finally {
      if (gen === generation.current) { busy.current = false; setIsRestoring(false); }
    }
  }, [storageKey]);

  // Dùng cùng luồng khôi phục cho lần mở trang và khi chọn một hội thoại trong lịch sử.
  useEffect(() => {
    const id = sessionId.current;
    if (id) void openSession(id);
    else setIsRestoring(false);
  }, [openSession]);

  const send = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query || busy.current || isRestoring || sessionError) return;
    busy.current = true;
    const gen = generation.current;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: query, timestamp: now }
    ]);
    setIsLoading(true);

    try {
      const data = await apiRequest<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: query, sessionId: sessionId.current })
      });

      // Phiên đã bị dọn giữa lúc chờ: câu trả lời này thuộc cuộc trò chuyện cũ nên bỏ đi.
      if (gen !== generation.current) return;

      sessionId.current = data.sessionId;
      storeSession(storageKey, data.sessionId);
      setActiveSessionId(data.sessionId);
      void loadHistory();
      if (data.escalated) setEscalated(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: data.suggestions?.length ? data.suggestions : undefined
        }
      ]);
    } catch (error) {
      if (gen !== generation.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorMessage(error, 'Rất tiếc đã có gián đoạn kết nối. Bạn vui lòng thử lại câu hỏi nhé!'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      if (gen === generation.current) { busy.current = false; setIsLoading(false); }
    }
  }, [storageKey, loadHistory, isRestoring, sessionError]);

  /** FR-BOT-11. Lỗi ở đây không được làm phiền khách — phản hồi là việc phụ. */
  const rate = useCallback(async (value: 1 | -1) => {
    const id = sessionId.current;
    if (!id) return;
    setSatisfaction(value);
    try {
      await apiRequest('/api/chat/feedback', {
        method: 'POST',
        body: JSON.stringify({ sessionId: id, satisfaction: value })
      });
    } catch {
      /* bỏ qua */
    }
  }, []);

  /**
   * Bắt đầu một cuộc trò chuyện mới. Chỉ buông phiên ở phía client: hội thoại cũ vẫn nằm
   * nguyên trên server và có thể mở lại từ danh sách lịch sử của tài khoản.
   * Lượt gửi kế tiếp không kèm id nên server mở phiên mới.
   *
   * `generation` tăng lên để mọi lời gọi mạng đang bay của phiên cũ bị bỏ qua khi về: nếu
   * không có nó, câu trả lời cho câu hỏi cuối của phiên cũ sẽ rơi vào khung chat vừa dọn.
   */
  const reset = useCallback(() => {
    generation.current += 1;
    sessionId.current = null;
    clearStoredSession(storageKey);
    setActiveSessionId(null);
    setSessionError(null);
    busy.current = false;
    setMessages([]);
    setEscalated(false);
    setSatisfaction(null);
    setIsLoading(false);
    setIsRestoring(false);
  }, [storageKey]);

  return { sessions, activeSessionId, historyLoading, historyError, sessionError,
    hasMoreHistory: nextOffset !== null, loadHistory, openSession,
    messages, isLoading, isRestoring, escalated, satisfaction, send, rate, reset };
}

const ChatSessionContext = createContext<ChatSession | null>(null);

function AccountChatSessionProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const session = useSharedChatSession(userId);
  return <ChatSessionContext.Provider value={session}>{children}</ChatSessionContext.Provider>;
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { user, isInitialising } = useAuth();
  if (isInitialising) return <div role="status" className="p-6 text-center">Đang tải tài khoản...</div>;
  return <AccountChatSessionProvider key={user?.id ?? 'guest'} userId={user?.id ?? null}>
    {children}
  </AccountChatSessionProvider>;
}

/**
 * Một khung nhìn của phiên chat dùng chung. `greeting` là lời chào riêng của khung nhìn đó và
 * không bao giờ được gửi lên server — nó chỉ đứng đầu danh sách hiển thị.
 */
export function useChatSession(greeting: ChatMessage): ChatSession {
  const session = useContext(ChatSessionContext);
  if (!session) {
    throw new Error('useChatSession phải nằm trong <ChatSessionProvider>');
  }

  // useMemo để mảng giữ nguyên tham chiếu giữa các lần render: AIConciergeTab dùng `messages`
  // làm dependency cho hiệu ứng cuộn xuống cuối, mảng mới mỗi lần render sẽ cuộn liên tục.
  const messages = useMemo(() => [greeting, ...session.messages], [greeting, session.messages]);

  return { ...session, messages };
}
