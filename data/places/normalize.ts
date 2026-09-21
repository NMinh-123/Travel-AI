/**
 * Chuẩn hoá tên địa danh — quy ước của chính danh mục, không phải chi tiết của tầng truy xuất.
 *
 * Đặt ở `data/` vì `Place.aliases` được KHAI ở dạng đã chuẩn hoá (xem chú thích trong
 * data/places/types.ts), nên định nghĩa "đã chuẩn hoá nghĩa là gì" thuộc về nơi khai dữ liệu.
 * `server/domain/rag/places.ts` dùng lại đúng hàm này để phân giải tên khách gõ, và
 * `data/validate.ts` dùng nó để phát hiện alias mơ hồ. Ba nơi phải cùng một phép chuẩn hoá —
 * tách ra hai bản là mở đường cho một alias qua được bộ kiểm định nhưng không bao giờ khớp lúc
 * chạy thật.
 *
 * Bỏ dấu là bắt buộc chứ không phải tiện tay: đo trên tập thử, mười một trên hai mươi câu hỏi hợp
 * lệ được truy xuất đúng là nhờ nhánh từ khoá bỏ dấu, tức người dùng gõ không dấu là chuyện
 * thường xuyên chứ không phải ngoại lệ.
 */
export function normalizePlaceName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
