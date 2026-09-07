import React, { useEffect, useState } from 'react';
import { Destination, MapWaypoint } from '../types';
import { Mountain, Compass, ShieldAlert, Sparkles, ChevronRight, CloudSun } from 'lucide-react';
import { ErrorState, LoadingState } from './LoadingState';
import { useMapWaypoints } from '../hooks/useContent';

interface HighlandsMapProps {
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  onAskAI: (query: string) => void;
  /** Tên địa danh cần chọn sẵn khi bản đồ được mở từ nơi khác, ví dụ từ một chặng lịch trình. */
  focusLocation?: string;
}

/** Tiền tố hành chính và từ nối không mang thông tin định danh địa điểm. */
const NOISE_WORDS = new Set([
  'thị', 'trấn', 'thành', 'phố', 'bản', 'làng', 'xã', 'huyện', 'khu',
  'hoặc', 'hay', 'và', 'tại', 'town', 'city', 'village'
]);

function significantWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !NOISE_WORDS.has(word));
}

/** Tỉ lệ từ khoá của một tên waypoint xuất hiện trong tên đang cần tra. */
function matchScore(candidate: string, needle: string[]): number {
  const keywords = significantWords(candidate);
  if (keywords.length === 0) return 0;

  const hits = keywords.filter(word => needle.includes(word)).length;
  return hits / keywords.length;
}

/**
 * Khớp một tên địa danh dạng tự do với waypoint trên bản đồ. Tên đến từ lịch trình do AI
 * sinh ra nên không theo từ điển cố định — "Thị trấn Đồng Văn" và "Phố Cổ Đồng Văn" là
 * cùng một chỗ — nên phải chấm điểm theo số từ khoá trùng nhau thay vì so khớp chuỗi con.
 * Trả về null khi không đủ tin cậy, để bản đồ giữ nguyên điểm đang chọn thay vì nhảy sai.
 */
function findWaypoint(waypoints: MapWaypoint[], locationName: string): MapWaypoint | null {
  const needle = significantWords(locationName);
  if (needle.length === 0) return null;

  let best: MapWaypoint | null = null;
  let bestScore = 0;

  for (const pt of waypoints) {
    const score = Math.max(matchScore(pt.vietnamese, needle), matchScore(pt.name, needle));
    if (score > bestScore) {
      best = pt;
      bestScore = score;
    }
  }

  return bestScore >= 0.5 ? best : null;
}

/**
 * Waypoint đến từ /api/content/map-waypoints (trước đây là một const trong file này). Phần
 * tải dữ liệu tách ra vỏ ngoài để phần vẽ bản đồ luôn nhận được một mảng không rỗng — nếu
 * không, `selectedPoint` sẽ phải nullable và hơn 300 dòng JSX bên dưới đầy kiểm tra null.
 */
export const HighlandsMap: React.FC<HighlandsMapProps> = (props) => {
  const waypoints = useMapWaypoints();

  if (waypoints.isLoading) return <LoadingState label="Đang tải bản đồ cung đường..." />;
  if (waypoints.error) {
    return <ErrorState message={waypoints.error} onRetry={waypoints.reload} />;
  }

  const points = waypoints.data ?? [];
  if (points.length === 0) {
    return (
      <ErrorState
        message="Database chưa có waypoint nào. Chạy `npm run db:seed` để nạp dữ liệu bản đồ."
        onRetry={waypoints.reload}
      />
    );
  }

  return <HighlandsMapView {...props} waypoints={points} />;
};

const HighlandsMapView: React.FC<HighlandsMapProps & { waypoints: MapWaypoint[] }> = ({
  destinations,
  onSelectDestination,
  onAskAI,
  focusLocation = '',
  waypoints
}) => {
  const [selectedPoint, setSelectedPoint] = useState<MapWaypoint>(
    () => waypoints.find(pt => pt.id === 'ma-pi-leng') ?? waypoints[0]
  );
  const [filterLayer, setFilterLayer] = useState<'all' | 'pass' | 'scenic' | 'water' | 'culture'>('all');

  // Bản đồ mở từ một chặng lịch trình thì chọn sẵn waypoint tương ứng, và bỏ filter để
  // chắc chắn điểm đó đang hiện trên canvas.
  useEffect(() => {
    const matched = findWaypoint(waypoints, focusLocation);
    if (!matched) return;
    setSelectedPoint(matched);
    setFilterLayer('all');
  }, [waypoints, focusLocation]);

  const filteredPoints = waypoints.filter(p => filterLayer === 'all' || p.type === filterLayer);

  // SVG route path coordinates string
  const routePathD = waypoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';

  const handlePointClick = (pt: MapWaypoint) => {
    setSelectedPoint(pt);
  };

  const matchedDest = destinations.find(d => d.id === selectedPoint.destinationRef);


  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#005c55] mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Loop Elevation & Route Navigator</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#181c1c]">
            Bản Đồ Cung Đường Vòng Cung Hà Giang
          </h2>
          <p className="text-sm sm:text-base text-[#3e4947] mt-1">
            Theo dõi cao độ, độ hiểm trở từng con dốc và các trạm dừng chân biểu tượng trên vòng cung 350km.
          </p>
        </div>

        {/* Layer Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'Tất Cả Trạm' },
            { id: 'pass', label: '⛰️ Đèo & Dốc' },
            { id: 'scenic', label: '📸 Điểm Ngắm Cảnh' },
            { id: 'water', label: '💧 Sông & Thác' },
            { id: 'culture', label: '🏮 Bản Làng' },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => setFilterLayer(l.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterLayer === l.id
                  ? 'bg-[#005c55] text-white shadow-xs'
                  : 'bg-white text-[#3e4947] border border-[#e0e3e1] hover:bg-[#f1f4f3]'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Map & Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        
        {/* Left Interactive SVG Map Canvas */}
        <div className="lg:col-span-8 bg-[#181c1c] rounded-3xl p-6 relative overflow-hidden shadow-xl border border-[#2d3130] flex flex-col justify-between min-h-[500px]">
          
          {/* Map Controls & Status Badge */}
          <div className="flex items-center justify-between z-10 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Vòng Cung QL4C & ĐT176 • 350 km</span>
            </div>

            <div className="text-xs text-[#80d5cb] bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
              Nhấp vào trạm để xem thông số độ cao
            </div>
          </div>

          {/* SVG Map Layer */}
          <div className="relative w-full h-[400px] flex items-center justify-center">
            <svg 
              viewBox="0 0 950 650" 
              className="w-full h-full select-none"
              style={{ filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.5))' }}
            >
              {/* Mountain Karst Contours Background effect */}
              <path
                d="M 50,600 Q 200,300 450,450 T 850,200 L 900,600 Z"
                fill="rgba(0, 92, 85, 0.08)"
              />
              <path
                d="M 150,550 Q 400,150 700,350 T 900,100 L 920,600 Z"
                fill="rgba(0, 81, 213, 0.05)"
              />

              {/* Loop Road Glow Line */}
              <path
                d={routePathD}
                fill="none"
                stroke="#0051d5"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
              />

              {/* Main Loop Road Line */}
              <path
                d={routePathD}
                fill="none"
                stroke="#005c55"
                strokeWidth="4"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Waypoint Dots & Labels */}
              {filteredPoints.map((pt) => {
                const isSelected = selectedPoint.id === pt.id;
                return (
                  <g 
                    key={pt.id} 
                    className="cursor-pointer transition-transform group"
                    onClick={() => handlePointClick(pt)}
                  >
                    {/* Pulsing ring on selected */}
                    {isSelected && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="18"
                        fill="none"
                        stroke="#80d5cb"
                        strokeWidth="2"
                        className="animate-ping opacity-75"
                      />
                    )}

                    {/* Outer Circle Pin */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 10 : 7}
                      fill={isSelected ? '#0051d5' : pt.type === 'pass' ? '#ba1a1a' : pt.type === 'water' ? '#0051d5' : '#005c55'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    {/* Point Name Label */}
                    <text
                      x={pt.x}
                      y={pt.y - 14}
                      textAnchor="middle"
                      fill={isSelected ? '#80d5cb' : '#ffffff'}
                      fontSize={isSelected ? '13' : '11'}
                      fontWeight={isSelected ? 'bold' : '500'}
                      className="transition-all drop-shadow-md pointer-events-none"
                    >
                      {pt.vietnamese}
                    </text>

                    {/* Elevation Subtitle */}
                    <text
                      x={pt.x}
                      y={pt.y + 20}
                      textAnchor="middle"
                      fill="#bdc9c6"
                      fontSize="9"
                      fontWeight="400"
                      className="pointer-events-none"
                    >
                      {pt.elevation}m
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10 text-xs text-[#bdc9c6] z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
              <span>Đèo & Dốc hiểm trở</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0051d5]" />
              <span>Sông Nho Quế & Thác Du Già</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#005c55]" />
              <span>Kỳ quan & Bản làng cổ</span>
            </div>
          </div>

        </div>

        {/* Right Side: Selected Waypoint Detail Card */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          <div className="bg-white rounded-3xl p-6 border border-[#e0e3e1] shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-[#005c55]/10 text-[#005c55] text-xs font-bold uppercase tracking-wider">
                  Trạm Vòng Cung
                </span>
                <span className="text-xs font-semibold text-[#181c1c] bg-[#f1f4f3] px-2.5 py-1 rounded-lg">
                  Km {selectedPoint.km} từ TP Hà Giang
                </span>
              </div>

              <h3 className="font-display text-2xl font-bold text-[#181c1c] mb-1">
                {selectedPoint.vietnamese}
              </h3>
              <span className="text-xs text-[#6e7977] block mb-4">
                {selectedPoint.name}
              </span>

              {/* Elevation & Air Gauge */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[#f7faf8] p-3.5 rounded-2xl border border-[#e0e3e1]">
                  <div className="flex items-center gap-1.5 text-xs text-[#6e7977] mb-1">
                    <Mountain className="w-3.5 h-3.5 text-[#005c55]" />
                    <span>Độ Cao Tuyệt Đối</span>
                  </div>
                  <span className="font-display text-xl font-bold text-[#005c55]">
                    {selectedPoint.elevation} mét
                  </span>
                  <span className="text-[10px] text-[#3e4947] block mt-0.5">
                    so với mực nước biển
                  </span>
                </div>

                <div className="bg-[#f7faf8] p-3.5 rounded-2xl border border-[#e0e3e1]">
                  <div className="flex items-center gap-1.5 text-xs text-[#6e7977] mb-1">
                    <CloudSun className="w-3.5 h-3.5 text-amber-600" />
                    <span>Khí Hậu Đặc Trưng</span>
                  </div>
                  <span className="font-display text-base font-bold text-[#181c1c]">
                    {selectedPoint.elevation > 1200 ? 'Lạnh, gió mạnh' : 'Mát mẻ dễ chịu'}
                  </span>
                  <span className="text-[10px] text-[#3e4947] block mt-0.5">
                    Nhiệt độ chênh lệch 4-6°C
                  </span>
                </div>
              </div>

              {/* Road Warning if any */}
              {selectedPoint.warning && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs mb-5 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Cảnh báo an toàn đường đèo:</span>
                    <span className="text-red-800">{selectedPoint.warning}</span>
                  </div>
                </div>
              )}

              {matchedDest && (
                <div className="mb-5">
                  <p className="text-xs text-[#3e4947] leading-relaxed line-clamp-3 mb-3">
                    {matchedDest.description}
                  </p>
                  <button
                    onClick={() => onSelectDestination(matchedDest)}
                    className="text-xs font-bold text-[#005c55] hover:underline flex items-center gap-1"
                  >
                    <span>Mở thư viện ảnh & chi tiết địa điểm</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Action CTA */}
            <div className="pt-4 border-t border-[#e0e3e1] space-y-2">
              <button
                onClick={() => onAskAI(`Hãy tư vấn chi tiết cách chinh phục và các điểm check-in tại ${selectedPoint.vietnamese} (độ cao ${selectedPoint.elevation}m)`)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0051d5] hover:bg-[#003ea8] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Sparkles className="w-4 h-4 text-sky-200" />
                <span>Hỏi AI Về Trạm Này</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Interactive Elevation Profile Bar at Bottom */}
      <div className="bg-white rounded-3xl p-6 border border-[#e0e3e1] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-display text-lg font-bold text-[#181c1c]">
              Biểu Đồ Trắc Diện Độ Cao Toàn Tuyến (Elevation Profile)
            </h4>
            <p className="text-xs text-[#3e4947]">
              Biến thiên độ cao từ TP Hà Giang (110m) qua các đỉnh đèo cao nhất Đông Bắc (1,520m) và hạ xuống hẻm Nho Quế (450m).
            </p>
          </div>
          <span className="text-xs font-semibold text-[#005c55] bg-[#005c55]/10 px-3 py-1 rounded-lg">
            Độ cao tối đa: 1,520m
          </span>
        </div>

        {/* Profile Bars */}
        <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-15 gap-1.5 items-end h-32 pt-4 border-b border-[#e0e3e1]">
          {waypoints.map((pt) => {
            const heightPercent = Math.max(15, (pt.elevation / 1550) * 100);
            const isSelected = selectedPoint.id === pt.id;
            return (
              <div
                key={pt.id}
                onClick={() => handlePointClick(pt)}
                className="group flex flex-col items-center justify-end h-full cursor-pointer"
              >
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all ${
                    isSelected
                      ? 'bg-[#0051d5] shadow-md scale-105'
                      : pt.elevation > 1400
                      ? 'bg-[#005c55] hover:bg-[#0f766e]'
                      : 'bg-[#bdc9c6] hover:bg-[#6e7977]'
                  }`}
                />
                <span className="text-[9px] font-mono text-[#6e7977] truncate w-full text-center mt-1 group-hover:text-[#181c1c]">
                  {pt.elevation}m
                </span>
              </div>
            );
          })}
        </div>

      </div>

    </section>
  );
};
