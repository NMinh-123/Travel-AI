import React from 'react';

/**
 * Bộ nút chọn dùng chung cho các bảng điều khiển.
 *
 * Tồn tại vì hai màn hình đang hỏi cùng một kiểu câu hỏi — số ngày, phương tiện, kiểu chỗ nghỉ —
 * mà lại hỏi bằng hai cách khác nhau: trình lập lịch trình dùng nút bấm cho hai tham số đầu rồi
 * đổi sang thẻ `select` kèm emoji cho hai tham số sau, còn máy tính ngân sách ở Sổ Tay dùng
 * `select` cho cả ba. Người dùng đi giữa hai màn phải học lại cách nhập mỗi lần. Gom về một
 * thành phần thì cả hai nơi cùng một hình dạng, và lần sau thêm tham số cũng không phải chọn lại.
 *
 * Cố ý KHÔNG dùng `select`: mỗi tham số ở đây chỉ có hai tới bốn lựa chọn và tất cả đều đáng
 * thấy cùng lúc, vì lựa chọn này ảnh hưởng trực tiếp tới con số hiện ngay bên cạnh. Giấu chúng
 * sau một lần bấm thì mất đúng cái lợi đó.
 */
export const ControlOption: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border text-center transition-all ${
      active
        ? 'bg-[#005c55] text-white border-[#005c55] shadow-xs'
        : 'bg-[#f7faf8] text-[#3e4947] border-[#e0e3e1] hover:border-[#bdc9c6]'
    }`}
  >
    {children}
  </button>
);

/**
 * Nhãn cộng lưới lựa chọn.
 *
 * Số cột viết thẳng từng trường hợp chứ không ghép chuỗi: Tailwind quét mã nguồn để biết cần
 * sinh lớp nào, nên một lớp dựng lúc chạy như `grid-cols-${cols}` sẽ không có trong CSS xuất
 * bản và lưới tụt về một cột — hỏng lặng lẽ, chỉ thấy khi mở trình duyệt.
 */
const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4'
};

export const ControlGroup: React.FC<{
  label: string;
  cols: 2 | 3 | 4;
  children: React.ReactNode;
}> = ({ label, cols, children }) => (
  <div>
    <label className="block text-xs font-semibold text-[#181c1c] uppercase tracking-wider mb-2">
      {label}
    </label>
    <div className={`grid gap-2 ${COLUMN_CLASS[cols]}`}>{children}</div>
  </div>
);
