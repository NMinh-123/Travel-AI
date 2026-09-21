import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Hai khối trạng thái dùng chung cho mọi chỗ đọc dữ liệu từ API. Có chúng thì năm component
 * không tự vẽ lại mỗi nơi một kiểu "đang tải" và "lỗi".
 */
export const LoadingState: React.FC<{ label?: string; className?: string }> = ({
  label = 'Đang tải dữ liệu...',
  className = ''
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex items-center justify-center gap-2.5 py-16 text-sm text-[#3e4947] ${className}`}
  >
    <RefreshCw className="w-4 h-4 animate-spin text-[#0051d5]" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message, onRetry, className = '' }) => (
  <div
    role="alert"
    className={`max-w-xl mx-auto my-10 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-900 ${className}`}
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-bold text-sm">Không tải được dữ liệu</p>
        <p className="text-xs text-red-800 mt-1 leading-relaxed">{message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  </div>
);
