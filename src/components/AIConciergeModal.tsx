import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User, RefreshCw, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types';

interface AIConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFullChat: () => void;
}

export const AIConciergeModal: React.FC<AIConciergeModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFullChat
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-init',
      role: 'assistant',
      content: 'Chào bạn! Tôi là Trợ Lý Thổ Địa AI Hà Giang. Bạn đang cần tư vấn về cung đường, thời tiết đèo hay điểm ăn nghỉ nào?',
      timestamp: 'Vừa xong',
      suggestions: [
        'Đường đèo Mã Pí Lèng có khó đi không?',
        'Thời tiết Lũng Cú hôm nay',
        'Gợi ý homestay view đẹp ở Pả Vi'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (customText?: string) => {
    const q = customText || input.trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: 'Bây giờ'
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Cảm ơn bạn. Tôi đã ghi nhận câu hỏi.',
          timestamp: 'Bây giờ',
          suggestions: data.suggestions
        }
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Không thể kết nối máy chủ AI. Vui lòng thử lại sau!',
          timestamp: 'Bây giờ'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#bdc9c6] flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 bg-[#0051d5] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm leading-tight">
                Trợ Lý Thổ Địa AI Hà Giang
              </h3>
              <p className="text-[10px] text-white/80">
                Sẵn sàng giải đáp 24/7 • Gemini 3.7
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[420px]">
          {messages.map((m) => (
            <div key={m.id} className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                m.role === 'user' ? 'bg-[#005c55] text-white' : 'bg-[#0051d5] text-white'
              }`}>
                {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              </div>

              <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-[#005c55] text-white rounded-tr-none'
                  : 'bg-[#f1f4f3] text-[#181c1c] rounded-tl-none border border-[#e0e3e1]'
              }`}>
                {m.content}

                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-black/5 flex flex-wrap gap-1.5">
                    {m.suggestions.slice(0, 3).map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(sug)}
                        className="text-[11px] text-[#0051d5] bg-[#0051d5]/10 hover:bg-[#0051d5] hover:text-white px-2.5 py-1 rounded-md transition-all text-left"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#6e7977] p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0051d5]" />
              <span>AI đang tra cứu dữ liệu thực địa...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 bg-[#f7faf8] border-t border-[#e0e3e1] flex items-center gap-2">
          <input
            type="text"
            placeholder="Hỏi về đường đèo, homestay, thời tiết..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#0051d5]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-[#0051d5] hover:bg-[#003ea8] text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <span>Gửi</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footer Link */}
        <div className="px-4 py-2 bg-white border-t border-[#e0e3e1] text-center">
          <button
            onClick={() => {
              onClose();
              onNavigateToFullChat();
            }}
            className="text-[11px] font-semibold text-[#0051d5] hover:underline"
          >
            Mở toàn màn hình hội thoại AI chuyên sâu &rarr;
          </button>
        </div>

      </div>
    </div>
  );
};
