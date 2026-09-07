import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Sparkles, Send, User, RefreshCw, Copy, Check, LifeBuoy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import { useChatSession } from '../hooks/useChatSession';

/**
 * Lời chào mở đầu. Là hằng số ngoài component để nó không đổi tham chiếu giữa các lần render —
 * useChatSession giữ nó làm tin nhắn đầu tiên khi khôi phục lịch sử.
 */
const GREETING: ChatMessage = {
  id: 'msg-0',
  role: 'assistant',
  content: `Xin chào quý khách! Tôi là **Trợ Lý Thổ Địa AI Hà Giang** của hệ thống Travel AI Hà Giang.

Tôi có thể hỗ trợ bạn 24/7 về:
- **Tình trạng đèo & an toàn lái xe**: Cập nhật dốc Mã Pí Lèng, Dốc Thẩm Mã, sương mù Bắc Sum.
- **Tư vấn lịch trình cá nhân hoá**: Thiết kế chuyến đi 3N2Đ, 4N3Đ theo phong cách riêng.
- **Thủ tục & kinh nghiệm**: Địa chỉ thuê xe uy tín, homestay view triệu đô, giá vé thuyền Nho Quế.
- **Văn hoá & Ẩm thực**: Phong tục các bản người Mông, Dao, Lô Lô và các món đặc sản chuẩn vị.

Bạn muốn bắt đầu khám phá điều gì ngay bây giờ?`,
  timestamp: 'Vừa xong',
  suggestions: [
    'Kinh nghiệm lái xe qua đèo Mã Pí Lèng an toàn',
    'Nên đi xe máy số hay tay ga khi phượt Hà Giang?',
    'Thời tiết các đỉnh đèo hôm nay thế nào?',
    'Top 5 món đặc sản không thể bỏ qua ở Đồng Văn'
  ]
};

interface AIConciergeTabProps {
  initialPrompt?: string;
}

export const AIConciergeTab: React.FC<AIConciergeTabProps> = ({ initialPrompt = '' }) => {
  const { messages, isLoading, isRestoring, escalated, satisfaction, send, rate } =
    useChatSession(GREETING);

  const [inputPrompt, setInputPrompt] = useState<string>(initialPrompt);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputPrompt.trim();
    if (!query || isLoading) return;
    setInputPrompt('');
    void send(query);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 min-h-[80vh] flex flex-col justify-between">
      
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0051d5]/10 border border-[#0051d5]/20 text-[#0051d5] text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Gemini-Powered Travel Concierge</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
          Trợ Lý Thổ Địa Đường Đèo Hà Giang
        </h2>
        <p className="text-sm text-[#3e4947] mt-1">
          Hỏi đáp trực tiếp về độ dốc, thời tiết, kinh nghiệm thuê xe, thủ tục và các mẹo thực chiến từ người bản địa.
        </p>
      </div>

      {/* Chat Conversation Card Container */}
      <div className="flex-1 bg-white rounded-3xl border border-[#e0e3e1] shadow-md flex flex-col overflow-hidden mb-6">
        
        {/* Chat Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-h-[580px]">
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
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <div className="leading-relaxed whitespace-pre-line">{msg.content}</div>
                )}

                {/* Copy button for Assistant */}
                {msg.role === 'assistant' && (
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

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0051d5] to-[#316bf3] text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="glass-card border border-[#bdc9c6] rounded-2xl rounded-tl-none p-4 text-xs text-[#3e4947] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0051d5]" />
                <span>Trợ lý AI đang tra cứu dữ liệu địa hình và tổng hợp câu trả lời...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chuyển tiếp nhân viên (FR-BOT-08). Cố tình KHÔNG hứa thời gian phản hồi: hệ thống
            chưa có vai trò CSKH nào đọc hàng đợi này. Cùng nguyên tắc với Footer — không để giao
            diện hứa một thứ hệ thống không thực hiện được. */}
        {escalated && (
          <div className="mx-4 sm:mx-6 mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <LifeBuoy className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">Đã ghi nhận để nhân viên hỗ trợ xem lại</p>
                <p className="leading-relaxed">
                  Nội dung trao đổi của bạn đã được lưu kèm ngữ cảnh đầy đủ. Bộ phận hỗ trợ trực
                  tiếp đang trong quá trình xây dựng nên chưa có mốc thời gian phản hồi.{' '}
                  <strong>Nếu là tình huống khẩn trên đường đèo</strong>, gọi ngay 113, 115 hoặc 114.
                </p>
              </div>
            </div>
          </div>
        )}

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
              disabled={isLoading}
              className="flex-1 bg-white border border-[#bdc9c6] rounded-2xl px-5 py-3.5 text-sm text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#0051d5] focus:ring-1 focus:ring-[#0051d5] shadow-xs"
            />
            <button
              id="btn-send-ai-chat"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputPrompt.trim()}
              className="px-6 py-3.5 rounded-2xl bg-[#0051d5] hover:bg-[#003ea8] text-white font-semibold text-sm shadow-md flex items-center gap-2 transition-all disabled:opacity-40"
            >
              <span>Gửi</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </section>
  );
};
