import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@shared/types';
import {
  Sparkles, Send, User, RefreshCw, Copy, Check, ThumbsUp, ThumbsDown,
  ShieldAlert, CloudSun, Route, Bed, MessageSquarePlus
} from 'lucide-react';
import { MarkdownMessage, StreamingCursor } from './MarkdownMessage';
import { useChatSession } from '@client/hooks/useChatSession';
import { useAuth } from '@client/context/AuthContext';

/**
 * Lời chào mở đầu. Là hằng số ngoài component để nó không đổi tham chiếu giữa các lần render —
 * useChatSession giữ nó làm tin nhắn đầu tiên khi khôi phục lịch sử.
 */
const GREETING: ChatMessage = {
  id: 'msg-0',
  role: 'assistant',
  content: `Xin chào! Tôi là **Trợ Lý Thổ Địa AI Hà Giang**.

Hỏi thẳng bằng tiếng Việt về đường đèo, thời tiết từng điểm, lịch trình hay chỗ nghỉ. Tôi trả lời trên dữ liệu của dự án.`,
  timestamp: 'Vừa xong',
  suggestions: [
    'Kinh nghiệm lái xe qua đèo Mã Pí Lèng an toàn',
    'Nên đi xe máy số hay tay ga khi phượt Hà Giang?',
    'Thời tiết các đỉnh đèo hôm nay thế nào?',
    'Top 5 món đặc sản không thể bỏ qua ở Đồng Văn'
  ]
};

/**
 * Bốn năng lực, đặt ở rãnh bên chứ không nằm trong bong bóng chào.
 *
 * Trước đây danh sách này là phần thân của tin nhắn chào: nó chiếm gần hết khung chat lúc mở
 * màn, đẩy ô nhập xuống dưới, và vì là nội dung tin nhắn nên nó cuộn đi mất ngay khi có câu
 * hỏi đầu tiên — đúng lúc người dùng cần biết còn hỏi được gì nữa thì nó không còn ở đó.
 * Đưa ra rãnh bên thì nó đứng yên suốt phiên, và lời chào ngắn lại đúng một câu.
 */
const ABILITIES = [
  {
    icon: ShieldAlert,
    title: 'Tình trạng đèo và an toàn lái xe',
    note: 'Sương Bắc Sum, dốc Thẩm Mã, Mã Pí Lèng'
  },
  {
    icon: CloudSun,
    title: 'Thời tiết theo từng điểm',
    note: 'Số liệu quan trắc kèm giờ ghi nhận'
  },
  {
    icon: Route,
    title: 'Lịch trình cá nhân hoá',
    note: '3N2Đ tới 5N4Đ theo phong cách và ngân sách'
  },
  {
    icon: Bed,
    title: 'Chỗ nghỉ và chi phí',
    note: 'Danh mục chỗ nghỉ kèm giá tham khảo'
  }
];

interface AIConciergeTabProps {
  initialPrompt?: string;
}

export const AIConciergeTab: React.FC<AIConciergeTabProps> = ({ initialPrompt = '' }) => {
  const { messages, isLoading, stageLabel, isRestoring, satisfaction, send, rate, reset,
    sessions, activeSessionId, historyLoading, historyError, sessionError, hasMoreHistory,
    loadHistory, openSession } =
    useChatSession(GREETING);
  const { isAuthenticated, openAuthModal } = useAuth();
  const chatBusy = isLoading || isRestoring || !!sessionError;
  // Model đã bắt đầu viết: bong bóng tin nhắn tự nó là chỉ báo, nên khung chờ riêng phải
  // nhường chỗ thay vì đứng song song với chữ đang chạy.
  const streamingNow = messages.some((msg) => msg.streaming);

  const [inputPrompt, setInputPrompt] = useState<string>(initialPrompt);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputPrompt.trim();
    if (!query || chatBusy) return;
    setInputPrompt('');
    void send(query);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewChat = () => {
    reset();
    setInputPrompt('');
  };

  /*
   * Mặt chat cao đúng bằng khung nhìn: chỉ danh sách tin nhắn cuộn bên trong, nên ô nhập
   * luôn ở đáy màn hình thay vì bị đẩy xuống cuối trang.
   */
  return (
    <section className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
      
      {/* Header */}
      <div className="mb-5 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#0051d5] mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trợ lý Thổ Địa</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#181c1c]">
            Hỏi người biết đường
          </h2>

                <button
                  id="btn-new-chat"
                  onClick={handleNewChat}
                  disabled={isLoading || isRestoring}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#bdc9c6] hover:border-[#0051d5] hover:text-[#0051d5] text-xs font-semibold text-[#181c1c] shadow-xs transition-all"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Trò chuyện mới</span>
                </button>
        </div>
        <p className="hidden sm:block text-sm sm:text-base text-[#3e4947] mt-2 max-w-3xl leading-relaxed">
          Trả lời bằng tiếng Việt trên dữ liệu của dự án: thời tiết quan trắc theo điểm, danh mục
          điểm đến và bảng giá chỗ nghỉ.
        </p>
      </div>

      {/* Chat Conversation Card Container */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-7">

        <aside className="lg:w-80 shrink-0 min-h-0 lg:overflow-y-auto pr-1 space-y-4">
          <details open className="bg-white rounded-2xl border border-[#e0e3e1] p-4">
            <summary className="cursor-pointer font-semibold text-sm">Lịch sử trò chuyện</summary>
            {!isAuthenticated ? (
              <div className="mt-3 text-sm text-[#3e4947]">
                <p>Đăng nhập để lưu và xem lại các cuộc trò chuyện trên mọi thiết bị.</p>
                <button onClick={() => openAuthModal('login')} className="mt-2 text-[#0051d5] font-semibold">Đăng nhập</button>
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-40 lg:max-h-80 overflow-y-auto" aria-label="Các cuộc trò chuyện">
                <button disabled={historyLoading} onClick={() => void loadHistory()} className="text-xs text-[#0051d5] disabled:opacity-50">Làm mới lịch sử</button>
                {historyError && <p role="alert" className="text-xs text-red-700">{historyError}</p>}
                {!historyLoading && !historyError && sessions.length === 0 && <p className="text-xs text-[#6e7977]">Chưa có cuộc trò chuyện nào. Hãy gửi câu hỏi đầu tiên.</p>}
                {sessions.map((session) => (
                  <button key={session.id} disabled={isLoading || isRestoring}
                    aria-current={activeSessionId === session.id ? 'true' : undefined}
                    onClick={() => { setInputPrompt(''); void openSession(session.id); }}
                    className={`block w-full text-left rounded-xl p-3 border text-sm disabled:opacity-50 ${activeSessionId === session.id ? 'border-[#0051d5] bg-blue-50' : 'border-[#e0e3e1] hover:bg-[#f7faf8]'}`}>
                    <span className="block truncate font-medium">{session.title}</span>
                    <time dateTime={session.lastActiveAt} className="block mt-1 text-xs text-[#6e7977]">{new Date(session.lastActiveAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</time>
                  </button>
                ))}
                {historyLoading && <p role="status" className="text-xs text-[#6e7977]">Đang tải lịch sử...</p>}
                {hasMoreHistory && <button disabled={historyLoading} onClick={() => void loadHistory(true)} className="text-xs text-[#0051d5] disabled:opacity-50">Xem thêm</button>}
              </div>
            )}
          </details>
          <div className="hidden lg:block bg-white rounded-2xl border border-[#e0e3e1] p-5">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#181c1c] mb-4">
              Trợ lý trả lời được gì
            </span>
            <div className="space-y-4">
              {ABILITIES.map((ability) => {
                const Icon = ability.icon;
                return (
                  <div key={ability.title} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-[#005c55] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[13px] font-semibold text-[#181c1c] leading-snug">
                        {ability.title}
                      </span>
                      <span className="block text-[11px] text-[#6e7977] leading-snug mt-0.5">
                        {ability.note}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bấm là gửi luôn, giống hệt các viên gợi ý trong khung chat — cùng một loại hành
              động thì không nên cư xử khác nhau ở hai chỗ. */}
          <div className="hidden lg:block bg-white rounded-2xl border border-[#e0e3e1] p-5">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#181c1c] mb-3">
              Bắt đầu nhanh
            </span>
            <div className="space-y-2">
              {(GREETING.suggestions ?? []).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={chatBusy}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-[#f7faf8] border border-[#e0e3e1] hover:border-[#bdc9c6] hover:bg-[#ebefed] text-xs font-medium text-[#3e4947] leading-snug transition-all disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </aside>

      <div className="flex-1 min-h-0 min-w-0 bg-white rounded-3xl border border-[#e0e3e1] shadow-md flex flex-col overflow-hidden">
        {sessionError && <div role="alert" className="p-4 text-sm text-red-700">
          {sessionError}{' '}
          {activeSessionId && <button onClick={() => void openSession(activeSessionId)} className="underline">Thử lại</button>}
          {' '}<button onClick={handleNewChat} className="underline">Trò chuyện mới</button>
        </div>}
        
        {/* Chat Messages List */}
        {/* id ổn định để E2E phân biệt khung hội thoại với danh sách lịch sử ở thanh bên: cùng một
            câu hỏi xuất hiện ở cả hai chỗ, nên không có mốc này thì mọi phép tìm theo chữ đều trùng. */}
        <div id="chat-messages" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                msg.role === 'user'
                  ? 'bg-[#005c55] text-white'
                  : 'bg-gradient-to-br from-[#0051d5] to-[#316bf3] text-white'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#005c55] text-white rounded-tr-none shadow-sm'
                  : 'glass-card border border-[#bdc9c6]/80 text-[#181c1c] rounded-tl-none shadow-xs'
              }`}>
                
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-black/5 text-[11px] opacity-70">
                  <span className="font-semibold">
                    {msg.role === 'user' ? 'Bạn' : 'Trợ Lý Thổ Địa AI'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Trợ lý trả lời bằng markdown; tin nhắn của người dùng giữ nguyên văn */}
                {msg.role === 'assistant' ? (
                  <>
                    <MarkdownMessage content={msg.content} />
                    {msg.streaming && <StreamingCursor />}
                  </>
                ) : (
                  <div className="leading-relaxed whitespace-pre-line">{msg.content}</div>
                )}

                {/* Nút sao chép chỉ hiện khi câu trả lời đã xong: sao chép một câu đang viết dở
                    thì thứ vào clipboard là một bản không bao giờ tồn tại ở đâu cả. */}
                {msg.role === 'assistant' && !msg.streaming && (
                  <div className="mt-3 pt-2 border-t border-[#e0e3e1] flex items-center justify-end">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-[11px] text-[#6e7977] hover:text-[#0051d5] flex items-center gap-1 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép câu trả lời</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Quick suggestions pills */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#e0e3e1]">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#0051d5] block mb-2">
                      Gợi ý câu hỏi tiếp theo:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSendMessage(sug)}
                          disabled={chatBusy}
                          className="text-xs text-[#0051d5] bg-[#0051d5]/10 hover:bg-[#0051d5] hover:text-white px-3 py-1.5 rounded-lg border border-[#0051d5]/20 font-medium transition-all text-left"
                        >
                          {sug} &rarr;
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))}

          {isRestoring && (
            <div className="text-center text-xs text-[#6e7977] py-2">
              Đang khôi phục lịch sử trò chuyện...
            </div>
          )}

          {/* Khung chờ, chỉ dựng tới khi chữ đầu tiên về */}
          {isLoading && !streamingNow && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0051d5] to-[#316bf3] text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="glass-card border border-[#bdc9c6] rounded-2xl rounded-tl-none p-4 text-xs text-[#3e4947] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0051d5]" />
                <span role="status" aria-live="polite">
                  {stageLabel ?? 'Trợ lý AI đang xử lý câu hỏi của bạn...'}
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Thu thập phản hồi sau phiên hỗ trợ (FR-BOT-11) */}
        {messages.length > 2 && (
          <div className="mx-4 sm:mx-6 mb-4 flex items-center justify-end gap-3 text-xs text-[#6e7977]">
            {satisfaction === null ? (
              <>
                <span>Câu trả lời có hữu ích không?</span>
                <button
                  onClick={() => void rate(1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bdc9c6] hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Hữu ích</span>
                </button>
                <button
                  onClick={() => void rate(-1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bdc9c6] hover:border-rose-500 hover:text-rose-700 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Chưa ổn</span>
                </button>
              </>
            ) : (
              <span className="text-emerald-700 font-medium">Cảm ơn bạn đã phản hồi.</span>
            )}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 bg-[#f7faf8] border-t border-[#e0e3e1]">
          <div className="flex items-center gap-3">
            <input
              id="input-ai-chat"
              type="text"
              placeholder="Hỏi bất kỳ điều gì về đường đèo, homestay, thời tiết Hà Giang..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={chatBusy}
              className="flex-1 bg-white border border-[#bdc9c6] rounded-2xl px-5 py-3.5 text-sm text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#0051d5] focus:ring-1 focus:ring-[#0051d5] shadow-xs"
            />
            <button
              id="btn-send-ai-chat"
              onClick={() => handleSendMessage()}
              disabled={chatBusy || !inputPrompt.trim()}
              className="px-6 py-3.5 rounded-2xl bg-[#0051d5] hover:bg-[#003ea8] text-white font-semibold text-sm shadow-md flex items-center gap-2 transition-all disabled:opacity-40"
            >
              <span>Gửi</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      </div>

    </section>
  );
};
