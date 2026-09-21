import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface AskConciergeBandProps {
  /** Chuyển câu hỏi sang tab Thổ Địa AI. Dùng chung đường đi với nút nổi và nút trên navbar. */
  onAsk: (prompt: string) => void;
}

/**
 * Câu hỏi gợi ý.
 *
 * Đây là những câu hệ thống ĐANG trả lời được, không phải câu quảng cáo: hai câu đầu là hai ca
 * kiểm thử của tầng tác tử (lịch trình nhiều ngày và thời tiết theo điểm), hai câu sau đi vào
 * dữ liệu mùa và bảng giá chỗ nghỉ. Gợi ý một câu mà trợ lý trả lời hỏng thì tệ hơn là không
 * gợi ý gì, nên danh sách này chỉ nên đổi khi đã thử lại.
 */
const SUGGESTIONS = [
  'Du lịch 3 ngày 2 đêm',
  'Hôm nay thời tiết Đồng Văn thế nào',
  'Đi tháng 9 có gì đẹp',
  'Chỗ nghỉ ở Mèo Vạc giá bao nhiêu'
];

/**
 * Dải hỏi nhanh, đè lên mép dưới hero.
 *
 * Trợ lý là thứ phân biệt sản phẩm này với một trang giới thiệu du lịch thường, nhưng trước đây
 * chỉ vào được qua một tab trên navbar và một nút nổi ở góc — cả hai đều là thứ khách phải tự
 * tìm. Đặt ô hỏi ngay trên đường mắt đi xuống là cách rẻ nhất để nói "hỏi được" mà không cần
 * thêm một dòng quảng cáo nào.
 */
export const AskConciergeBand: React.FC<AskConciergeBandProps> = ({ onAsk }) => {
  const [question, setQuestion] = useState<string>('');

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setQuestion('');
  };

  return (
    <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-14">
      <div className="bg-white border border-[#e0e3e1] rounded-2xl shadow-xl shadow-black/5 p-4 sm:p-6 flex flex-col gap-3.5">
        <form
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(question);
          }}
        >
          <div className="relative flex-1 flex items-center">
            <Sparkles className="w-4 h-4 text-[#0051d5] absolute left-3.5 pointer-events-none" />
            <input
              id="input-ask-concierge"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Hỏi bất cứ điều gì về cung đường…"
              aria-label="Câu hỏi cho trợ lý Thổ Địa AI"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-[#bdc9c6] text-sm text-[#181c1c] placeholder-[#6e7977] focus:outline-none focus:border-[#0051d5] focus:ring-1 focus:ring-[#0051d5] transition-all"
            />
          </div>

          <button
            id="btn-ask-concierge"
            type="submit"
            disabled={question.trim().length === 0}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0051d5] hover:bg-[#0042ad] disabled:bg-[#bdc9c6] disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Hỏi Thổ Địa AI</span>
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#6e7977]">Thử:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submit(suggestion)}
              className="px-3 py-1.5 rounded-full bg-[#f1f4f3] border border-[#e0e3e1] hover:border-[#bdc9c6] hover:bg-[#ebefed] text-xs font-medium text-[#3e4947] transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
