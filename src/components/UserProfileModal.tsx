import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Award, Heart, LogOut, Mountain, Phone, CheckCircle, Route, Trash2 } from 'lucide-react';
import type { Destination, UserProfile } from '../types';

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
interface EmergencyPhoneFieldProps {
  savedPhone: string;
  onSave: (phone: string) => Promise<{ success: boolean; error?: string }>;
  onError: (message: string | null) => void;
}

const EmergencyPhoneField: React.FC<EmergencyPhoneFieldProps> = ({
  savedPhone,
  onSave,
  onError
}) => {
  const [phone, setPhone] = useState(savedPhone);
  const [isSaved, setIsSaved] = useState(false);

  /**
   * Chờ server xác nhận rồi mới báo "đã lưu". Bản trước gọi updateProfile không await nên
   * dấu tích hiện lên trước khi biết request có thành công hay không.
   */
  const handleSave = async () => {
    onError(null);
    const result = await onSave(phone);

    if (!result.success) {
      onError(result.error ?? 'Không lưu được số điện thoại');
      return;
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-[#181c1c] uppercase tracking-wider mb-2">
        Số Điện Thoại Liên Hệ Cứu Hộ / Đặt Xe
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="w-4 h-4 text-[#6e7977] absolute left-3.5 top-3" />
          <input
            type="tel"
            placeholder="Nhập số điện thoại (ví dụ: 0912 345 678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f7faf8] border border-[#bdc9c6] rounded-xl focus:outline-none focus:border-[#005c55] text-[#181c1c]"
          />
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2.5 bg-[#005c55] hover:bg-[#0f766e] text-white rounded-xl text-xs font-semibold transition-colors"
        >
          {isSaved ? 'Đã lưu!' : 'Lưu lại'}
        </button>
      </div>
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
  const { user, logout, updateProfile, toggleFavorite, savedItineraries, deleteSavedItinerary } =
    useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'favorites' | 'itineraries' | 'badges'>(
    'info'
  );
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
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-white text-[#005c55] text-[9px] font-bold uppercase tracking-wider shadow-xs">
                {user.provider}
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

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-white/90">
                <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                  <Mountain className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Trình độ: {user.riderLevel || 'Đã có kinh nghiệm'}</span>
                </span>
                <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg">
                  <Heart className="w-3.5 h-3.5 text-red-300" />
                  <span>{user.favoriteDestinations.length} Điểm yêu thích</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#e0e3e1] bg-[#f7faf8] px-6 pt-3">
          {[
            { id: 'info', label: '👤 Hồ Sơ & Cài Đặt' },
            { id: 'favorites', label: `❤️ Điểm Đã Lưu (${user.favoriteDestinations.length})` },
            { id: 'itineraries', label: `🗺️ Lịch Trình (${savedItineraries.length})` },
            { id: 'badges', label: '🏆 Huy Hiệu Phượt' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-[#005c55] text-[#005c55] bg-white rounded-t-lg'
                  : 'border-transparent text-[#6e7977] hover:text-[#181c1c]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Tab 1: Info & Preferences */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              
              {/* Rider Experience Level Selector */}
              <div>
                <label className="block text-xs font-bold text-[#181c1c] uppercase tracking-wider mb-2">
                  Kinh Nghiệm Lái Xe Đèo Dốc
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'Mới bắt đầu', desc: 'Chưa từng đi đèo, cần đường dễ & cảnh báo sớm' },
                      { id: 'Đã có kinh nghiệm', desc: 'Tự tin đi xe số, có kỹ năng hãm động cơ' },
                      { id: 'Phượt thủ lão luyện', desc: 'Sẵn sàng vượt cung hiểm trở như Mã Pí Lèng' },
                      { id: 'Đi theo tour Easy Rider', desc: 'Ngồi sau tài xế bản địa, ưu tiên ngắm cảnh' }
                    ] as { id: NonNullable<UserProfile['riderLevel']>; desc: string }[]
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      onClick={() => handleLevelChange(lvl.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        user.riderLevel === lvl.id
                          ? 'border-[#005c55] bg-[#005c55]/5 ring-1 ring-[#005c55]'
                          : 'border-[#e0e3e1] bg-[#f7faf8] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#181c1c]">{lvl.id}</span>
                        {user.riderLevel === lvl.id && (
                          <CheckCircle className="w-3.5 h-3.5 text-[#005c55]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6e7977] mt-0.5">{lvl.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emergency Contact Phone */}
              <EmergencyPhoneField
                savedPhone={user.phone ?? ''}
                onSave={(phone) => updateProfile({ phone })}
                onError={setSaveError}
              />

              {saveError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {saveError}
                </div>
              )}

              {/* Account Quick Stats */}
              <div className="bg-[#f7faf8] rounded-2xl p-4 border border-[#e0e3e1] grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#6e7977] block text-[11px]">Đăng nhập bằng</span>
                  <span className="font-bold text-[#181c1c] capitalize">Tài khoản {user.provider}</span>
                </div>
                <div>
                  <span className="text-[#6e7977] block text-[11px]">Ngày gia nhập</span>
                  <span className="font-mono text-[#181c1c]">
                    {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>

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
                          {dest.elevation}m • {dest.district}
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
                        onClick={() => deleteSavedItinerary(itinerary.id)}
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

          {/* Tab 4: Badges */}
          {activeTab === 'badges' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Chinh phục Mã Pí Lèng', desc: 'Đã check-in đỉnh đèo hùng vĩ nhất Đông Bắc', earned: true },
                { title: 'Cột Cờ Cực Bắc Lũng Cú', desc: 'Chạm mốc địa đầu thiêng liêng của Tổ quốc', earned: true },
                { title: 'Thuyền Sông Nho Quế', desc: 'Du ngoạn hẻm vực Tu Sản sâu nhất Đông Nam Á', earned: true },
                { title: 'Tay Lái Lụa Vòng Cung', desc: 'Hoàn thành trọn vẹn 350km QL4C & ĐT176', earned: false },
                { title: 'Thổ Địa Bản Làng', desc: 'Nghỉ đêm và giao lưu văn hóa tại Lô Lô Chải / Du Già', earned: false }
              ].map((badge, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                    badge.earned
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                      : 'bg-[#f7faf8] border-[#e0e3e1] opacity-60'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    badge.earned ? 'bg-amber-500 text-white shadow-xs' : 'bg-[#e0e3e1] text-[#6e7977]'
                  }`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#181c1c]">{badge.title}</span>
                      {badge.earned && (
                        <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded">
                          ĐÃ ĐẠT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6e7977] mt-0.5">{badge.desc}</p>
                  </div>
                </div>
              ))}
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
