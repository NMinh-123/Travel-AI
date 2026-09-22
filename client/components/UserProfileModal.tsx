import React, { useState } from 'react';
import { useAuth } from '@client/context/AuthContext';
import { X, Heart, LogOut, Mountain, Phone, CheckCircle, Route, Trash2, KeyRound, AlertTriangle, User as UserIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Destination, UserProfile } from '@shared/types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** App đã lấy danh sách điểm đến từ API, truyền xuống để không gọi lặp endpoint. */
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  onOpenPlanner: () => void;
}

/**
 * Ô số điện thoại cứu hộ, tách riêng vì lý do vòng đời chứ không phải vì bố cục.
 *
 * App mount UserProfileModal vô điều kiện ngay khi khởi động, lúc đó `user` còn null. Bản cũ
 * giữ state số điện thoại ở component cha và khởi tạo bằng `useState(user?.phone || '')` — một
 * lần duy nhất, với user là null — nên ô nhập luôn rỗng dù hồ sơ đã có số, và bấm "Lưu lại" là
 * ghi chuỗi rỗng đè lên số đang lưu. Đây là số liên hệ cứu hộ đường đèo, mất là mất im lặng.
 *
 * Component này chỉ được render khi modal đã mở và đã có user, nên nó mount lại mỗi lần mở
 * modal và state luôn khởi tạo từ giá trị thật của hồ sơ.
 */
interface InlineSaveFieldProps {
  label: string;
  hint?: string;
  icon: LucideIcon;
  type?: 'text' | 'tel';
  placeholder: string;
  savedValue: string;
  onSave: (value: string) => Promise<{ success: boolean; error?: string }>;
  onError: (message: string | null) => void;
}

/**
 * Một ô nhập kèm nút lưu riêng. Tên hiển thị và số điện thoại dùng chung component này — trước
 * đây chỉ số điện thoại có, còn tên thì không sửa được ở đâu cả.
 *
 * Nút lưu chỉ bật khi giá trị đã khác bản đang lưu: một nút luôn bấm được nhưng phần lớn thời
 * gian không làm gì là thứ khiến người dùng bấm thử để xem có tác dụng không.
 */
const InlineSaveField: React.FC<InlineSaveFieldProps> = ({
  label,
  hint,
  icon: Icon,
  type = 'text',
  placeholder,
  savedValue,
  onSave,
  onError
}) => {
  const [value, setValue] = useState(savedValue);
  const [isSaved, setIsSaved] = useState(false);
  const isDirty = value.trim() !== savedValue.trim();

  /**
   * Chờ server xác nhận rồi mới báo "đã lưu". Bản trước gọi updateProfile không await nên
   * dấu tích hiện lên trước khi biết request có thành công hay không.
   */
  const handleSave = async () => {
    onError(null);
    const result = await onSave(value);

    if (!result.success) {
      onError(result.error ?? `Không lưu được ${label.toLowerCase()}`);
      return;
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-[#181c1c] mb-1.5">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] text-[#181c1c]"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-4 py-2.5 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl text-xs font-semibold transition-colors disabled:bg-[#bdc9c6] disabled:cursor-default"
        >
          {isSaved ? 'Đã lưu' : 'Lưu'}
        </button>
      </div>
      {hint && <p className="text-[11px] text-[#6e7977] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
};

/** Nhãn tiếng Việt cho cách đăng nhập. Cột `provider` trong database là enum viết hoa. */
const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email và mật khẩu',
  google: 'Tài khoản Google'
};

/**
 * Đổi mật khẩu. Chỉ hiện với tài khoản đăng nhập bằng email — tài khoản Google không có mật
 * khẩu nào ở hệ thống này để mà đổi.
 */
const PasswordSection: React.FC<{
  onChangePassword: (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
}> = ({ onChangePassword }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMessage(null);
    const result = await onChangePassword(current, next);

    if (!result.success) {
      setMessage({ ok: false, text: result.error ?? 'Không đổi được mật khẩu' });
      return;
    }
    // Xoá cả hai ô ngay khi xong: để mật khẩu nằm lại trong form đã đóng là thứ không cần thiết.
    setCurrent('');
    setNext('');
    setMessage({ ok: true, text: 'Đã đổi mật khẩu' });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e0e3e1] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#005c55]" />
          <span className="text-xs font-semibold text-[#181c1c]">Mật khẩu</span>
        </div>
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="text-[11px] font-semibold text-[#0051d5] hover:underline"
        >
          {isOpen ? 'Đóng' : 'Đổi mật khẩu'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mật khẩu hiện tại"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55]"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55]"
          />
          <button
            onClick={submit}
            disabled={!current || next.length < 8}
            className="w-full py-2.5 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold transition-colors disabled:bg-[#bdc9c6] disabled:cursor-default"
          >
            Cập nhật mật khẩu
          </button>
        </div>
      )}

      {message && (
        <p className={`text-[11px] mt-2 ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
};

/**
 * Xoá tài khoản.
 *
 * Người dùng phải gõ lại email của chính mình, và server kiểm lại lần nữa. Một nút "Xoá" kèm
 * hộp thoại xác nhận thì bấm theo phản xạ là mất sạch; gõ lại địa chỉ thì không nhầm được.
 * Danh sách những thứ sẽ mất được liệt kê ra trước, vì chúng biến mất cùng lúc và không khôi
 * phục được — yêu thích, lịch trình đã lưu và toàn bộ lịch sử trò chuyện.
 */
const DangerZone: React.FC<{
  email: string;
  onDelete: (confirmEmail: string) => Promise<{ success: boolean; error?: string }>;
  onDeleted: () => void;
}> = ({ email, onDelete, onDeleted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await onDelete(typed);
    if (!result.success) {
      setError(result.error ?? 'Không xoá được tài khoản');
      return;
    }
    onDeleted();
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-xs font-semibold text-red-900">Xoá tài khoản</span>
        </div>
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="text-[11px] font-semibold text-red-700 hover:underline"
        >
          {isOpen ? 'Huỷ' : 'Tôi muốn xoá'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-red-900 leading-relaxed">
            Xoá vĩnh viễn tài khoản cùng toàn bộ điểm đã lưu, lịch trình và lịch sử trò
            chuyện. Không khôi phục được. Gõ <strong className="font-semibold">{email}</strong> để
            xác nhận.
          </p>
          <input
            type="email"
            autoComplete="off"
            placeholder="Nhập lại email của bạn"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-red-300 rounded-xl focus:outline-none focus:border-red-500"
          />
          <button
            onClick={submit}
            disabled={typed.trim().toLowerCase() !== email.toLowerCase()}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:bg-red-200 disabled:cursor-default"
          >
            Xoá tài khoản vĩnh viễn
          </button>
          {error && <p className="text-[11px] text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  destinations,
  onSelectDestination,
  onOpenPlanner
}) => {
  const {
    user, logout, updateProfile, changePassword, deleteAccount,
    toggleFavorite, savedItineraries, deleteSavedItinerary
  } =
    useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'favorites' | 'itineraries'>('info');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const favoriteSpots = destinations.filter(d => user.favoriteDestinations.includes(d.id));

  const handleLevelChange = async (level: UserProfile['riderLevel']) => {
    setSaveError(null);
    const result = await updateProfile({ riderLevel: level });
    if (!result.success) setSaveError(result.error ?? 'Không lưu được trình độ lái xe');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e0e3e1] flex flex-col max-h-[88vh]">
        
        {/* Header with User Hero */}
        <div className="bg-gradient-to-r from-[#005c55] via-[#0f766e] to-[#0051d5] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-md bg-white"
              />
              {/* Nhãn cách đăng nhập. Trước đây in thẳng giá trị enum nên nó hiện "EMAIL". */}
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-white text-[#005c55] text-[9px] font-bold tracking-wide shadow-xs">
                {user.provider === 'google' ? 'Google' : 'Email'}
              </span>
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h2 className="text-xl font-bold font-display text-white">
                  {user.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 text-[10px] font-semibold">
                  Đã xác thực
                </span>
              </div>
              <p className="text-xs text-white/80 font-mono">
                {user.email}
              </p>

              {/*
                Chỉ giữ trình độ lái. Số điểm yêu thích đã có chip đếm ngay trên thanh tab, và
                lặp lại nó ở đây chỉ làm header rối chứ không cho biết thêm điều gì.
              */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-white/90">
                <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                  <Mountain className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{user.riderLevel || 'Chưa chọn trình độ lái'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/*
          THANH TAB. Bản trước dùng emoji làm biểu tượng (👤 ❤️ 🗺️ 🏆) trong khi cả ứng dụng
          dùng bộ icon lucide: emoji vẽ khác nhau trên từng hệ điều hành, không đổi màu theo
          trạng thái chọn, và không căn được với chữ. Bốn nhãn dài lại nằm trong một `flex`
          không cuộn, nên ở màn hẹp chúng bị bóp lại hoặc tràn ra ngoài.

          Số đếm tách khỏi nhãn thành chip riêng — "Điểm đã lưu (3)" bắt người đọc phân tích dấu
          ngoặc, còn một chip số thì thấy ngay, và nó tự biến mất khi chưa có gì để đếm.
        */}
        <div className="flex gap-1 border-b border-[#e0e3e1] bg-[#f7faf8] px-3 sm:px-6 pt-3 overflow-x-auto">
          {[
            { id: 'info', label: 'Hồ sơ', icon: UserIcon, count: null },
            { id: 'favorites', label: 'Điểm đã lưu', icon: Heart, count: user.favoriteDestinations.length },
            { id: 'itineraries', label: 'Lịch trình', icon: Route, count: savedItineraries.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-[#005c55] text-[#005c55] bg-white rounded-t-lg'
                    : 'border-transparent text-[#6e7977] hover:text-[#181c1c]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-[#005c55] text-white' : 'bg-[#e0e3e1] text-[#3e4947]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/*
            Tab 1: Hồ sơ.

            Bản trước là ba khối rời nhau không có thứ bậc: bộ chọn trình độ lái bốn thẻ lớn
            chiếm gần hết chiều cao, một ô số điện thoại, rồi một khối thống kê nhạt nhoà. Tên
            hiển thị, mật khẩu và việc xoá tài khoản thì không có đường nào để làm.

            Nay chia ba nhóm theo việc người dùng định làm: sửa thông tin của mình, khai trình độ
            lái để hệ thống gợi ý đúng sức, và các thao tác lên chính tài khoản.
          */}
          {activeTab === 'info' && (
            <div className="space-y-5">

              <section className="space-y-3">
                <h3 className="text-xs font-bold text-[#181c1c]">Thông tin cá nhân</h3>

                <InlineSaveField
                  label="Tên hiển thị"
                  icon={UserIcon}
                  placeholder="Tên của bạn"
                  savedValue={user.name}
                  onSave={(name) => updateProfile({ name })}
                  onError={setSaveError}
                />

                <InlineSaveField
                  label="Số điện thoại liên hệ"
                  hint="Dùng khi cần liên hệ cứu hộ hoặc đặt xe. Chỉ bạn nhìn thấy số này."
                  icon={Phone}
                  type="tel"
                  placeholder="Ví dụ: 0912 345 678"
                  savedValue={user.phone ?? ''}
                  onSave={(phone) => updateProfile({ phone })}
                  onError={setSaveError}
                />

                {/* Email không sửa được vì nó là khoá định danh tài khoản và là thứ dùng để xác
                    nhận khi xoá; đổi email cần luồng xác minh riêng, chưa xây. */}
                <div className="bg-[#f7faf8] rounded-2xl p-3.5 border border-[#e0e3e1] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 min-w-0">
                    <span className="text-[#6e7977] block text-[11px]">Email đăng nhập</span>
                    <span className="font-medium text-[#181c1c] truncate block">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-[#6e7977] block text-[11px]">Đăng nhập bằng</span>
                    <span className="font-medium text-[#181c1c]">
                      {PROVIDER_LABELS[user.provider] ?? user.provider}
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div>
                  <h3 className="text-xs font-bold text-[#181c1c]">Kinh nghiệm lái đèo</h3>
                  <p className="text-[11px] text-[#6e7977] mt-0.5">
                    Trợ lý dựa vào mục này để gợi ý cung đường và cảnh báo phù hợp với bạn.
                  </p>
                </div>

                {/* Bốn thẻ lớn thu thành hàng gọn: đây là một lựa chọn duy nhất, không đáng
                    chiếm nửa màn hình. Mô tả vẫn giữ vì bốn mức này không tự nói hết nghĩa. */}
                <div className="space-y-1.5">
                  {(
                    [
                      { id: 'Mới bắt đầu', desc: 'Chưa từng đi đèo, cần đường dễ và cảnh báo sớm' },
                      { id: 'Đã có kinh nghiệm', desc: 'Tự tin đi xe số, có kỹ năng hãm động cơ' },
                      { id: 'Phượt thủ lão luyện', desc: 'Sẵn sàng vượt cung hiểm trở như Mã Pí Lèng' },
                      { id: 'Đi theo tour Easy Rider', desc: 'Ngồi sau tài xế bản địa, ưu tiên ngắm cảnh' }
                    ] as { id: NonNullable<UserProfile['riderLevel']>; desc: string }[]
                  ).map((lvl) => {
                    const isPicked = user.riderLevel === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        onClick={() => handleLevelChange(lvl.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                          isPicked
                            ? 'border-[#005c55] bg-[#005c55]/5'
                            : 'border-[#e0e3e1] bg-[#f7faf8] hover:bg-white'
                        }`}
                      >
                        <CheckCircle
                          className={`w-4 h-4 shrink-0 ${isPicked ? 'text-[#005c55]' : 'text-[#bdc9c6]'}`}
                        />
                        <span className="min-w-0">
                          <span className="text-xs font-semibold text-[#181c1c] block">{lvl.id}</span>
                          <span className="text-[11px] text-[#6e7977] block leading-snug">{lvl.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-bold text-[#181c1c]">Tài khoản</h3>

                <div className="bg-[#f7faf8] rounded-2xl p-3.5 border border-[#e0e3e1] text-xs">
                  <span className="text-[#6e7977] block text-[11px]">Ngày tạo tài khoản</span>
                  <span className="font-medium text-[#181c1c]">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {user.provider === 'email' && (
                  <PasswordSection onChangePassword={changePassword} />
                )}

                <DangerZone
                  email={user.email}
                  onDelete={deleteAccount}
                  onDeleted={onClose}
                />
              </section>

              {saveError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {saveError}
                </div>
              )}

            </div>
          )}

          {/* Tab 2: Favorites */}
          {activeTab === 'favorites' && (
            <div className="space-y-4">
              {favoriteSpots.length === 0 ? (
                <div className="text-center py-10 bg-[#f7faf8] rounded-2xl border border-[#e0e3e1]">
                  <Heart className="w-8 h-8 text-[#bdc9c6] mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-[#181c1c]">Chưa có địa điểm yêu thích</h4>
                  <p className="text-xs text-[#6e7977] mt-1">
                    Nhấn vào biểu tượng trái tim ở các thẻ địa danh để lưu vào danh sách của bạn.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favoriteSpots.map((dest) => (
                    <div
                      key={dest.id}
                      className="bg-[#f7faf8] rounded-2xl border border-[#e0e3e1] p-3 flex items-center gap-3 group hover:border-[#005c55] transition-all"
                    >
                      <img
                        src={dest.imageUrl}
                        alt={dest.vietnameseName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-[#181c1c] truncate">
                          {dest.vietnameseName}
                        </h4>
                        <span className="text-[10px] text-[#005c55] font-semibold block">
                          {dest.elevation != null ? `${dest.elevation}m • ` : ''}{dest.district}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => {
                              onClose();
                              onSelectDestination(dest);
                            }}
                            className="text-[11px] text-[#0051d5] font-semibold hover:underline"
                          >
                            Xem chi tiết &rarr;
                          </button>
                          <button
                            onClick={() => toggleFavorite(dest.id)}
                            className="text-[11px] text-red-500 hover:underline"
                          >
                            Bỏ lưu
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Lịch trình đã lưu — trước đây UserProfile.savedItineraries là một trường
              chỉ có trong type mà không đường nào ghi vào và không chỗ nào hiển thị. */}
          {activeTab === 'itineraries' && (
            <div className="space-y-3">
              {saveError && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {saveError}
                </div>
              )}
              {savedItineraries.length === 0 ? (
                <div className="text-center py-10">
                  <Route className="w-10 h-10 text-[#bdc9c6] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#181c1c]">
                    Bạn chưa lưu lịch trình nào
                  </p>
                  <p className="text-xs text-[#6e7977] mt-1 max-w-sm mx-auto leading-relaxed">
                    Vào tab lập lịch trình, để AI tạo một cung đường theo ý bạn rồi bấm
                    "Lưu lịch trình" — nó sẽ xuất hiện ở đây.
                  </p>
                  <button
                    onClick={onOpenPlanner}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#005c55] hover:bg-[#0f766e] text-white text-xs font-semibold transition-colors"
                  >
                    Mở trình lập lịch trình
                  </button>
                </div>
              ) : (
                savedItineraries.map((itinerary) => (
                  <div
                    key={itinerary.id}
                    className="p-4 rounded-2xl border border-[#e0e3e1] bg-[#f7faf8] hover:bg-white transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-display text-sm font-bold text-[#181c1c] leading-snug">
                          {itinerary.title}
                        </h4>
                        <p className="text-xs text-[#3e4947] mt-1 line-clamp-2 leading-relaxed">
                          {itinerary.overview}
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          setSaveError(null);
                          const result = await deleteSavedItinerary(itinerary.id);
                          if (!result.success) {
                            setSaveError(result.error ?? 'Không xoá được lịch trình');
                          }
                        }}
                        aria-label={`Xoá lịch trình ${itinerary.title}`}
                        className="p-2 rounded-lg text-[#6e7977] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-[#6e7977]">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] font-medium">
                        {itinerary.days.length} ngày
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-[#bdc9c6] font-medium">
                        ~{itinerary.totalKm.toLocaleString('vi-VN')} km
                      </span>
                      <span>
                        Lưu ngày {new Date(itinerary.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#f7faf8] border-t border-[#e0e3e1] flex items-center justify-between">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>

          <div className="flex items-center gap-2">
            {/* onOpenPlanner được App truyền vào nhưng trước đây không có gì gọi tới. */}
            <button
              onClick={onOpenPlanner}
              className="px-4 py-2 rounded-xl border border-[#bdc9c6] text-xs font-semibold text-[#005c55] hover:bg-white transition-colors flex items-center gap-1.5"
            >
              <Mountain className="w-4 h-4" />
              <span>Lập lịch trình mới</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
