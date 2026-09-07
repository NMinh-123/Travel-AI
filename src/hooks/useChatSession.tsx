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
import { ApiError, apiRequest, errorMessage } from '../lib/api';
import type { ChatMessage } from '../types';

/**
 * Trạng thái một phiên hội thoại với chatbot.
 *
 * Trước Vòng 5, lịch sử chat chỉ nằm trong React state nên mất sạch khi F5 và không đồng bộ giữa
 * các thiết bị — FR-BOT-07 (*Bắt buộc*) chưa đạt. Giờ server giữ lịch sử, client chỉ giữ
 * `sessionId`.
 *
 * `sessionId` nằm ở localStorage chứ không phải cookie: SRS Mục 7.2 cho khách vãng lai trò chuyện
 * mà không cần tài khoản, nên phải có cách nhận lại phiên khi chưa đăng nhập. Khi khách đăng
 * nhập, server tự gắn phiên vào tài khoản và từ đó nó đồng bộ đa thiết bị.
 *
 * Phiên được giữ ở MỘT chỗ duy nhất: ChatSessionProvider bọc cả ứng dụng, widget nổi và tab chat
 * đầy đủ chỉ là hai khung nhìn của cùng state đó. Bản trước mỗi nơi gọi hook riêng nên mỗi nơi
 * giữ một `sessionId` độc lập: khách hỏi ở tab rồi mở widget là widget mở phiên mới và ghi đè
 * localStorage, mất toàn bộ hội thoại cũ sau khi tải lại trang.
 */
const SESSION_KEY = 'travel_ai_chat_session';

function readStoredSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư): phiên vẫn chạy được, chỉ là không nhận
    // lại được sau khi tải lại trang.
    return null;
  }
}

function storeSession(id: string): void {
  try {
    window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* không lưu được thì thôi, không phải lỗi chặn luồng */
  }
}

function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
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
  messages: ChatMessage[];
  isLoading: boolean;
  isRestoring: boolean;
  escalated: boolean;
  satisfaction: number | null;
  send: (text: string) => Promise<void>;
  rate: (value: 1 | -1) => Promise<void>;
}

/**
 * State dùng chung, KHÔNG chứa lời chào: widget và tab mở đầu bằng hai lời chào khác nhau (một
 * câu ngắn cho khung nhỏ, một đoạn giới thiệu đầy đủ cho tab), nên mỗi khung nhìn tự ghép lời
 * chào của mình vào đầu danh sách. Phần hội thoại thật thì chỉ có một.
 */
function useSharedChatSession(): ChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [escalated, setEscalated] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const sessionId = useRef<string | null>(readStoredSession());

  // Nạp lại lịch sử khi mở trang. Phiên không còn (đã xoá, hoặc thuộc tài khoản khác) thì bỏ id
  // và bắt đầu phiên mới thay vì hiện lỗi — với khách, đây không phải sự cố.
  useEffect(() => {
    let cancelled = false;
    const id = sessionId.current;

    if (!id) {
      setIsRestoring(false);
      return;
    }

    apiRequest<SessionResponse>(`/api/chat/sessions/${encodeURIComponent(id)}`)
      .then((data) => {
        if (cancelled || data.messages.length === 0) return;
        setMessages(
          data.messages.map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: clockOf(row.timestamp),
            suggestions: row.suggestions?.length ? row.suggestions : undefined
          }))
        );
        setEscalated(data.escalated);
        setSatisfaction(data.satisfaction);
      })
      .catch((error) => {
        /**
         * Chỉ 404 mới là "phiên này không còn": đã bị xoá, hoặc thuộc tài khoản khác. Khi đó bỏ
         * id ở CẢ ref lẫn localStorage — bản trước chỉ xoá ref, nên id chết vẫn nằm trong
         * localStorage và mỗi lần mở lại trang là một lần gọi khôi phục chắc chắn hỏng.
         *
         * Mọi lỗi khác (mất mạng, server đang khởi động lại, 500) là tạm thời nên GIỮ NGUYÊN id.
         * Xoá ở đây là biến sự cố vài giây thành mất hẳn hội thoại: lượt gửi tiếp theo sẽ mở
         * phiên mới trong khi phiên cũ vẫn còn nguyên trên server, không ai quay lại đọc nữa.
         */
        if (error instanceof ApiError && error.status === 404) {
          sessionId.current = null;
          clearStoredSession();
        }
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query) return;

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

      sessionId.current = data.sessionId;
      storeSession(data.sessionId);
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
      setIsLoading(false);
    }
  }, []);

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

  return { messages, isLoading, isRestoring, escalated, satisfaction, send, rate };
}

const ChatSessionContext = createContext<ChatSession | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const session = useSharedChatSession();
  return <ChatSessionContext.Provider value={session}>{children}</ChatSessionContext.Provider>;
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
