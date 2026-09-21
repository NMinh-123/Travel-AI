/// <reference types="vite/client" />

/**
 * Khai báo kiểu cho những thứ Vite cho phép import mà TypeScript không tự biết:
 * `import './index.css'`, import ảnh/SVG, và `import.meta.env`.
 *
 * Không có file này, TypeScript bản mới báo lỗi ts(2882) "Cannot find module or type
 * declarations for side-effect import" ngay tại dòng `import './index.css'` trong
 * client/main.tsx. Bản TypeScript 5.8.3 mà `npm run lint` dùng chưa có kiểm tra đó nên
 * dòng lệnh vẫn xanh — chính sự lệch nhau ấy làm lỗi khó hiểu: IDE đỏ, terminal xanh.
 *
 * Đây là file chuẩn mà `npm create vite` sinh ra sẵn; dự án này thiếu nó từ đầu.
 */
