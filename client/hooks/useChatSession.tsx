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
import { ApiError, apiRequest, errorMessage, streamRequest } from '@client/lib/api';
import type { ChatMessage } from '@shared/types';
import { useAuth } from '@client/context/AuthContext';

/**
 * Trạng thái một phiên hội thoại với chatbot.
 *
 * MỖI LẦN MỞ TRANG LÀ MỘT CUỘC TRÒ CHUYỆN MỚI. Client không giữ `sessionId` qua các lần tải
 * trang: nó chỉ sống trong bộ nhớ của lượt truy cập hiện tại, đủ để các lượt nhắn nối nhau thành
 * một mạch hội thoại, rồi biến mất khi trang đóng hoặc F5.
 *
 * ĐÂY LÀ QUYẾT ĐỊNH SẢN PHẨM, KHÔNG PHẢI SƠ SUẤT, và nó lệch với FR-BOT-07 — điều khoản
 * *Bắt buộc* của SRS nói lịch sử chat phải sống sót qua F5 và đồng bộ giữa các thiết bị. Phần
 * đồng bộ vẫn đạt: mọi hội thoại đã gắn tài khoản vẫn nằm trên server và mở lại được từ danh
 * sách lịch sử, ở bất kỳ thiết bị nào. Thứ bị bỏ là việc TỰ ĐỘNG mở lại hội thoại gần nhất.
 * Đổi lại, người dùng luôn bắt đầu từ một khung sạch thay vì rơi vào giữa một mạch hội thoại cũ.
 * Muốn quay về hành vi cũ thì chỗ phải sửa là đúng file này, và phải sửa cả ghi chú trên.
 *
 * Hội thoại của khách vãng lai KHÔNG được giữ lại: nó không gắn tài khoản nào nên không mở lại
 * được từ đâu cả, và `pruneGuestSessions` trong server/infra/retention.ts dọn nó khỏi database
 * sau thời hạn đã cấu hình.
 *
 * Phiên được giữ ở MỘT chỗ duy nhất: ChatSessionProvider bọc cả ứng dụng, widget nổi và tab chat
 * đầy đủ chỉ là hai khung nhìn của cùng state đó. Bản trước mỗi nơi gọi hook riêng nên mỗi nơi
 * giữ một `sessionId` độc lập: khách hỏi ở tab rồi mở widget là widget mở phiên mới, và hai khung
 * nhìn trôi khỏi nhau ngay trong cùng một lượt truy cập.
 */

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

/**
 * Nhãn tiến trình cho từng bước của một lượt.
 *
 * Cần thiết vì phần lớn thời gian chờ nằm TRƯỚC chữ đầu tiên: phân loại ý định là một lượt gọi
 * model riêng, rồi tới nhúng vector và truy vấn pgvector. Không có nhãn này thì streaming chỉ rút
 * ngắn được nửa sau của quãng chờ, còn nửa đầu vẫn là một khung trống im lặng.
 *
 * Tên bước do server đặt (xem `TurnEvent`). Bước lạ thì không có nhãn, và giao diện quay về chỉ
 * báo đang xử lý — thà không nói gì còn hơn nói sai việc hệ thống đang làm.
 */
const STAGE_LABEL: Record<string, string> = {
  nlu: 'Đang hiểu câu hỏi...',
  route: 'Đang chọn hướng trả lời...',
  retrieval: 'Đang tra kho dữ liệu...',
  agent: 'Đang soạn câu trả lời...'
};

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
  /**
   * Bước mà lượt đang chạy đang ở, hoặc null khi không có lượt nào.
   *
   * Tách khỏi `isLoading` vì hai thứ trả lời hai câu hỏi khác nhau: `isLoading` quyết định
   * có khoá ô nhập hay không, còn cái này là thứ duy nhất nói cho khách biết hệ thống đang
   * làm gì trong quãng chờ trước chữ đầu tiên.
   */
  stageLabel: string | null;
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
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  /**
   * Chỉ bật khi khách CHỌN một hội thoại trong danh sách lịch sử.
   *
   * Khởi tạo `false` vì lúc mở trang không có gì để khôi phục nữa — trước đây nó khởi tạo `true`
   * và hiệu ứng đọc localStorage mới tắt đi. Để nguyên `true` thì ô nhập bị khoá vĩnh viễn ngay
   * từ lần render đầu, do `chatBusy` đọc trường này.
   */
  const [isRestoring, setIsRestoring] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  /**
   * Phiên của lượt truy cập hiện tại. Bắt đầu rỗng, và không bao giờ rời khỏi bộ nhớ này — đó
   * chính là cơ chế khiến mỗi lần mở trang là một cuộc trò chuyện mới.
   */
  const sessionId = useRef<string | null>(null);
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
      }
    } finally {
      if (gen === generation.current) { busy.current = false; setIsRestoring(false); }
    }
  }, []);

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
    setStageLabel(STAGE_LABEL.nlu);

    // Id cố định cho bong bóng của trợ lý: mọi sự kiện sau đó đều sửa đúng tin nhắn này thay vì
    // chèn thêm cái mới, kể cả khi nội dung bị xoá đi viết lại.
    const botId = `bot-${Date.now()}`;
    let streamed = '';
    let placed = false;

    const writeBot = (content: string, extra: Partial<ChatMessage> = {}) => {
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!placed) {
        placed = true;
        setMessages((prev) => [
          ...prev,
          { id: botId, role: 'assistant', content, timestamp: stamp, ...extra }
        ]);
        return;
      }
      setMessages((prev) =>
        prev.map((item) => (item.id === botId ? { ...item, content, ...extra } : item))
      );
    };

    try {
      const events = streamRequest('/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify({ message: query, sessionId: sessionId.current })
      });

      for await (const event of events) {
        // Phiên đã bị dọn giữa lúc chờ: phần còn lại của luồng thuộc cuộc trò chuyện cũ.
        // `break` chứ không `return`, để khối finally của generator đóng được socket.
        if (gen !== generation.current) break;

        if (event.type === 'session') {
          // Nhận id NGAY, không đợi `final`: một lượt hỏng giữa chừng mà chưa ghi lại id sẽ khiến
          // lượt nhắn kế tiếp mở phiên mới và bỏ rơi phiên vừa tạo cùng tin nhắn khách vừa gửi.
          const id = String(event.sessionId);
          sessionId.current = id;
          setActiveSessionId(id);
          continue;
        }

        if (event.type === 'stage') {
          setStageLabel(STAGE_LABEL[String(event.stage)] ?? null);
          continue;
        }

        if (event.type === 'reset') {
          // Guardrail đã chặn đoạn vừa hiện, hoặc lượt gọi model phải làm lại. Xoá sạch: nối
          // tiếp vào sau nó nghĩa là khách đọc được cả phần đã bị loại lẫn phần thay thế.
          streamed = '';
          if (placed) writeBot('', { streaming: true });
          continue;
        }

        if (event.type === 'delta') {
          streamed += String(event.text);
          writeBot(streamed, { streaming: true });
          continue;
        }

        if (event.type === 'error') {
          throw new ApiError(
            [event.error, event.details].filter(Boolean).join(' — ') || 'Máy chủ gặp sự cố',
            Number(event.status) || 500
          );
        }

        if (event.type === 'final') {
          /**
           * Gán ĐÈ bằng câu trả lời đã qua guardrail, không phải nối thêm.
           *
           * Đây là chỗ hợp đồng streaming khép lại: mọi thứ hiện trước đó chỉ là bản xem trước.
           * Thường nó trùng với phần đã stream, nhưng khi guardrail thay cả câu thì hai bên khác
           * hẳn nhau — và bản đúng luôn là bản ở đây.
           */
          const suggestions = Array.isArray(event.suggestions) ? (event.suggestions as string[]) : [];
          writeBot(String(event.reply), {
            streaming: false,
            ...(suggestions.length ? { suggestions } : {})
          });
          if (event.escalated) setEscalated(true);
          void loadHistory();
        }
      }
    } catch (error) {
      if (gen !== generation.current) return;
      // Chữ đã hiện thuộc về một lượt không kết thúc được: bỏ nó đi thay vì để lại một câu dở.
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== botId),
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorMessage(error, 'Rất tiếc đã có gián đoạn kết nối. Bạn vui lòng thử lại câu hỏi nhé!'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      if (gen === generation.current) {
        busy.current = false;
        setIsLoading(false);
        setStageLabel(null);
      }
    }
  }, [loadHistory, isRestoring, sessionError]);

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
    setActiveSessionId(null);
    setSessionError(null);
    busy.current = false;
    setMessages([]);
    setEscalated(false);
    setSatisfaction(null);
    setIsLoading(false);
    setStageLabel(null);
    setIsRestoring(false);
  }, []);

  return { sessions, activeSessionId, historyLoading, historyError, sessionError,
    hasMoreHistory: nextOffset !== null, loadHistory, openSession,
    messages, isLoading, stageLabel, isRestoring, escalated, satisfaction, send, rate, reset };
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
