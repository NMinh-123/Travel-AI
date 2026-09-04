import React, { useState } from 'react';
import { Destination } from '../types';
import { 
  Mountain, MapPin, Navigation, Compass, AlertCircle, 
  Wind, Fuel, Coffee, ShieldAlert, Sparkles, ExternalLink,
  ChevronRight, CloudSun
} from 'lucide-react';

interface HighlandsMapProps {
  destinations: Destination[];
  onSelectDestination: (dest: Destination) => void;
  onAskAI: (query: string) => void;
}

interface MapWaypoint {
  id: string;
  name: string;
  vietnamese: string;
  km: number;
  elevation: number;
  x: number; // SVG coordinate
  y: number;
  type: 'city' | 'pass' | 'scenic' | 'water' | 'culture';
  warning?: string;
  destinationRef?: string;
}

const MAP_WAYPOINTS: MapWaypoint[] = [
  { id: 'hg-city', name: 'Ha Giang City (Km 0)', vietnamese: 'TP Hà Giang (Km 0)', km: 0, elevation: 110, x: 120, y: 520, type: 'city' },
  { id: 'bac-sum', name: 'Bac Sum Slope', vietnamese: 'Dốc Bắc Sum', km: 28, elevation: 850, x: 200, y: 460, type: 'pass', warning: 'Sương mù sáng sớm, độ dốc lớn' },
  { id: 'quan-ba', name: 'Quan Ba Heaven Gate', vietnamese: 'Cổng Trời Quản Bạ', km: 46, elevation: 1500, x: 270, y: 410, type: 'scenic', destinationRef: 'quan-ba-heaven-gate' },
  { id: 'yen-minh', name: 'Yen Minh Pine Forest', vietnamese: 'Rừng Thông Yên Minh', km: 85, elevation: 980, x: 390, y: 340, type: 'scenic', destinationRef: 'yen-minh-pine-forest' },
  { id: 'tham-ma', name: 'Tham Ma Pass', vietnamese: 'Dốc Thẩm Mã', km: 115, elevation: 1100, x: 480, y: 260, type: 'pass', warning: '9 khúc cua tay áo liên tục', destinationRef: 'doc-tham-ma' },
  { id: 'sung-la', name: 'Sung La Valley (Pao House)', vietnamese: 'Thung Lũng Sủng Là', km: 128, elevation: 1020, x: 550, y: 210, type: 'culture' },
  { id: 'vuong-palace', name: 'H\'mong King Palace', vietnamese: 'Dinh Vua Mèo (Sà Phìn)', km: 138, elevation: 1150, x: 590, y: 170, type: 'culture' },
  { id: 'lung-cu', name: 'Lung Cu Flag Point', vietnamese: 'Cột Cờ Lũng Cú & Lô Lô Chải', km: 160, elevation: 1470, x: 620, y: 90, type: 'culture', destinationRef: 'lung-cu-flagpole' },
  { id: 'dong-van', name: 'Dong Van Old Quarter', vietnamese: 'Phố Cổ Đồng Văn', km: 145, elevation: 1050, x: 690, y: 180, type: 'city', destinationRef: 'dong-van-old-quarter' },
  { id: 'ma-pi-leng', name: 'Ma Pi Leng Pass', vietnamese: 'Đèo Mã Pí Lèng', km: 155, elevation: 1520, x: 780, y: 280, type: 'pass', warning: 'Vực sâu hẻm Tu Sản, gió lớn', destinationRef: 'ma-pi-leng' },
  { id: 'nho-que', name: 'Nho Que River Canyon', vietnamese: 'Bến Thuyền Sông Nho Quế', km: 165, elevation: 450, x: 830, y: 340, type: 'water', destinationRef: 'nho-que-river' },
  { id: 'meo-vac', name: 'Meo Vac Town', vietnamese: 'Thị Trấn Mèo Vạc', km: 175, elevation: 850, x: 760, y: 410, type: 'city' },
  { id: 'doc-chu-m', name: 'M Slope (Mau Due)', vietnamese: 'Dốc Cua Chữ M (Mậu Duệ)', km: 210, elevation: 1050, x: 660, y: 490, type: 'pass', warning: 'Khúc cua chữ M uốn lượn liên tiếp' },
  { id: 'du-gia', name: 'Du Gia Waterfall', vietnamese: 'Bản Tiên & Thác Du Già', km: 260, elevation: 780, x: 520, y: 560, type: 'water', destinationRef: 'du-gia-waterfall' },
  { id: 'thuan-hoa', name: 'Thuan Hoa Valley', vietnamese: 'Thung Lũng Thuận Hoà', km: 310, elevation: 350, x: 320, y: 550, type: 'scenic' }
];

export const HighlandsMap: React.FC<HighlandsMapProps> = ({
  destinations,
  onSelectDestination,
  onAskAI
}) => {
  const [selectedPoint, setSelectedPoint] = useState<MapWaypoint>(MAP_WAYPOINTS[9]); // Default Ma Pi Leng
  const [filterLayer, setFilterLayer] = useState<'all' | 'pass' | 'scenic' | 'water' | 'culture'>('all');

  const filteredPoints = MAP_WAYPOINTS.filter(p => filterLayer === 'all' || p.type === filterLayer);

  // SVG route path coordinates string
  const routePathD = MAP_WAYPOINTS.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ') + ' Z';

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
          {MAP_WAYPOINTS.map((pt) => {
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
