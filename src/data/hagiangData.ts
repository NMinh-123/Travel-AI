import { Destination, DayItinerary, WeatherPassStatus, GearItem, HomestaySpot } from '../types';

export const DESTINATIONS: Destination[] = [
  {
    id: 'ma-pi-leng',
    name: 'Mã Pí Lèng Pass',
    vietnameseName: 'Đèo Mã Pí Lèng & Hẻm Tu Sản',
    district: 'Mèo Vạc - Đồng Văn',
    category: 'pass',
    elevation: 1520,
    distanceFromStart: 155,
    difficulty: 'Đòi hỏi tay lái vững',
    bestTime: '07:00 - 09:00 (Săn mây) & 16:30 - 18:00 (Hoàng hôn)',
    highlights: ['Vua của các con đèo Việt Nam', 'Nhìn trọn Hẻm Tu Sản sâu nhất Đông Nam Á', 'Dải lụa sông Nho Quế xanh ngọc bích', 'Cung đường Hạnh Phúc huyền thoại'],
    imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Được mệnh danh là một trong "Tứ đại đỉnh đèo" của núi rừng Tây Bắc, dài khoảng 20km nối liền Đồng Văn và Mèo Vạc. Đứng trên đỉnh đèo, du khách sẽ choáng ngợp trước hẻm vực Tu Sản sâu 800m cùng dòng Nho Quế màu ngọc lam uốn lượn dưới chân.',
    safetyTip: 'Đường đèo có nhiều khúc cua tay áo và vực sâu không rào chắn phụ. Hãy đi số thấp (số 2 hoặc số 1 khi xuống dốc), không bóp phanh liên tục và tránh vượt xe tải ở khúc cua mù.',
    coordinates: { x: 740, y: 390, lat: 23.2394, lng: 105.4168 },
    weatherTag: {
      temp: 18,
      condition: 'Nắng nhẹ, gió đại ngàn',
      fogRisk: 'Trung bình'
    },
    recommendedStayHours: 3.5,
    localFood: ['Bánh tam giác mạch nướng than', 'Ngô nướng mật mía', 'Cà phê view đèo Panorama']
  },
  {
    id: 'nho-que-river',
    name: 'Nho Que Emerald River',
    vietnameseName: 'Chèo Thuyền Hẻm Tu Sản - Sông Nho Quế',
    district: 'Mèo Vạc',
    category: 'nature',
    elevation: 450,
    distanceFromStart: 165,
    difficulty: 'Trung bình',
    bestTime: '08:30 - 11:30 & 14:00 - 16:30',
    highlights: ['Trải nghiệm thuyền máy & chèo SUP hẻm Tu Sản', 'Vách đá vôi dựng đứng cao hàng trăm mét', 'Nước sông màu xanh ngọc bích đặc trưng'],
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Bắt nguồn từ vùng núi Vân Nam (Trung Quốc), chảy qua hẻm Tu Sản tạo nên tuyệt tác thiên nhiên hùng vĩ bậc nhất cao nguyên đá. Du khách có thể đi xe ôm của người bản địa xuống bến thuyền Tà Làng để trải nghiệm đi thuyền.',
    safetyTip: 'Đoạn đường dốc xuống bến Tà Làng cực kỳ dốc và quanh co. Khuyến nghị thuê dịch vụ xe ôm bản địa tay lái cứng đưa đón (giá khoảng 100k - 150k/khứ hồi).',
    coordinates: { x: 790, y: 440, lat: 23.2201, lng: 105.4356 },
    weatherTag: {
      temp: 22,
      condition: 'Nắng ấm trong lòng hẻm',
      fogRisk: 'Thấp'
    },
    recommendedStayHours: 2.5,
    localFood: ['Cá suối nướng muối ớt', 'Thịt treo gác bếp']
  },
  {
    id: 'lung-cu-flagpole',
    name: 'Lung Cu Flag Point',
    vietnameseName: 'Cột Cờ Quốc Gia Lũng Cú & Bản Lô Lô Chải',
    district: 'Đồng Văn',
    category: 'culture',
    elevation: 1470,
    distanceFromStart: 160,
    difficulty: 'Trung bình',
    bestTime: '08:00 - 11:00 hoặc 15:00 - 17:00',
    highlights: ['Điểm Cực Bắc thiêng liêng của Tổ quốc', 'Lá cờ đỏ sao vàng rộng 54m²', 'Bản Lô Lô Chải bình yên với nhà trình tường cổ kính', 'Quán Cà Phê Cực Bắc đậm chất văn hoá'],
    imageUrl: 'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Tọa lạc trên đỉnh núi Rồng (Long Sơn), Cột cờ Lũng Cú là biểu tượng chủ quyền thiêng liêng. Dưới chân cột cờ là làng cổ Lô Lô Chải xinh đẹp như bước ra từ truyện cổ tích với tường đất vàng, hoa đào, hoa cải rực rỡ.',
    safetyTip: 'Gió trên đỉnh núi Rồng khá mạnh. Đường từ Đồng Văn lên Lũng Cú quanh co nhưng chất lượng mặt đường tốt.',
    coordinates: { x: 620, y: 150, lat: 23.3639, lng: 105.3186 },
    weatherTag: {
      temp: 16,
      condition: 'Gió lộng, se lạnh',
      fogRisk: 'Trung bình'
    },
    recommendedStayHours: 3.0,
    localFood: ['Thắng dền nóng hổi', 'Thịt lợn đen nướng mắc khén', 'Trà shan tuyết cổ thụ']
  },
  {
    id: 'doc-tham-ma',
    name: 'Tham Ma Slope',
    vietnameseName: 'Dốc Thẩm Mã & Dốc Chín Khoanh',
    district: 'Yên Minh - Đồng Văn',
    category: 'pass',
    elevation: 1100,
    distanceFromStart: 115,
    difficulty: 'Trung bình',
    bestTime: '09:00 - 11:00 & 14:00 - 16:30',
    highlights: ['9 khúc cua tay áo uốn lượn ngoạn mục', 'Nơi thử sức ngựa thồ thời xưa', 'Điểm check-in cùng các em bé người Mông gùi hoa tam giác mạch'],
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Dốc Thẩm Mã là con dốc đèo nổi tiếng dẫn từ Yên Minh lên cao nguyên Đồng Văn. Tương truyền xưa kia là nơi thả ngựa leo dốc để thẩm định sức kéo dẻo dai của những chú ngựa vùng cao.',
    safetyTip: 'Tại đỉnh dốc thường có nhiều du khách dừng xe chụp ảnh, hãy giảm tốc độ từ xa và đỗ xe sát lề phải.',
    coordinates: { x: 520, y: 280, lat: 23.2104, lng: 105.1843 },
    recommendedStayHours: 1.0,
    localFood: ['Mía nướng khúc dốc', 'Trứng gà luộc ngâm thảo mộc']
  },
  {
    id: 'dong-van-old-quarter',
    name: 'Dong Van Ancient Town',
    vietnameseName: 'Phố Cổ Đồng Văn & Dinh Thự Họ Vương',
    district: 'Đồng Văn',
    category: 'culture',
    elevation: 1050,
    distanceFromStart: 145,
    difficulty: 'Dễ đi',
    bestTime: 'Buổi tối (Chợ đêm phố cổ) & Sáng Chủ Nhật (Chợ phiên)',
    highlights: ['Dinh Vua Mèo Vương Chính Đức bằng đá xanh và gỗ sa mộc', 'Khu phố cổ trên 100 năm tuổi với đèn lồng lấp lánh', 'Chợ phiên sắc màu hội tụ các dân tộc Dao, H\'Mông, Tày, Lô Lô'],
    imageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Thị trấn trung tâm sầm uất nhất trên cao nguyên đá. Kiến trúc giao thoa độc đáo giữa phong cách người Hoa, người Mông và kiến trúc thời Pháp thuộc. Nơi có món cháo ấu tẩu ấm bụng về đêm.',
    safetyTip: 'Phố cổ cấm xe máy vào tối cuối tuần để tổ chức không gian đi bộ.',
    coordinates: { x: 670, y: 260, lat: 23.2785, lng: 105.3621 },
    recommendedStayHours: 4.0,
    localFood: ['Cháo ấu tẩu (đặc sản giải cảm)', 'Phở Tráng Kìm tráng tay', 'Thắng cố ngựa nguyên bản']
  },
  {
    id: 'quan-ba-heaven-gate',
    name: 'Quan Ba Heaven Gate',
    vietnameseName: 'Cổng Trời Quản Bạ & Núi Đôi Cô Tiên',
    district: 'Quản Bạ',
    category: 'viewpoint',
    elevation: 1500,
    distanceFromStart: 46,
    difficulty: 'Trung bình',
    bestTime: '07:30 - 10:00 (Săn biển mây tràn thung lũng Tam Sơn)',
    highlights: ['Cửa ngõ đầu tiên bước vào Công viên địa chất toàn cầu', 'Đài quan sát nhìn trọn thung lũng Tam Sơn', 'Tuyệt tác tạo hoá Núi Đôi Cô Tiên tròn trịa'],
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Cửa ải huyền thoại năm 1939 từng có một cánh cửa khổng lồ bằng gỗ nghiến dày 150cm chặn giữ đường lên cao nguyên. Đứng tại Cổng Trời, du khách có thể phóng tầm mắt ôm trọn cảnh sắc thung lũng mây huyền ảo.',
    safetyTip: 'Dốc Bắc Sum dẫn lên Cổng Trời có sương mù vào sáng sớm. Bật đèn cốt và giảm tốc.',
    coordinates: { x: 280, y: 460, lat: 23.0583, lng: 104.9922 },
    recommendedStayHours: 1.5,
    localFood: ['Hồng không hạt Quản Bạ', 'Rượu ngô Thanh Vân']
  },
  {
    id: 'du-gia-waterfall',
    name: 'Du Gia Hidden Waterfall',
    vietnameseName: 'Bản Tiên Du Già & Thác Ba Tiên',
    district: 'Yên Minh - Bắc Mê',
    category: 'waterfall',
    elevation: 780,
    distanceFromStart: 110,
    difficulty: 'Đòi hỏi tay lái vững',
    bestTime: '11:00 - 15:30 (Tắm thác & chill suối)',
    highlights: ['Thác nước trong vắt giữa thung lũng nguyên sơ', 'Cung đèo Mậu Duệ - Du Già hoang dã tráng lệ', 'Trải nghiệm Homestay người Tày bên nương lúa'],
    imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Viên ngọc ẩn của Hà Giang dành cho những tâm hồn yêu thiên nhiên hoang sơ. Du Già sở hữu dòng thác Ba Tiên mát lạnh, những nếp nhà sàn thanh bình và không khí trong lành tuyệt đối.',
    safetyTip: 'Đoạn đường từ Mậu Duệ sang Du Già có một số đoạn sỏi đá gồ ghề và đèo hẹp, cần xe số hoặc cào cào máy khỏe.',
    coordinates: { x: 490, y: 640, lat: 22.9125, lng: 105.2317 },
    recommendedStayHours: 3.5,
    localFood: ['Cơm lam nếp nương', 'Gà đồi nướng mọi than hoa', 'Cá suối chiên giòn']
  },
  {
    id: 'yen-minh-pine-forest',
    name: 'Yen Minh Pine Forest',
    vietnameseName: 'Rừng Thông Yên Minh & Dốc Bắc Sum',
    district: 'Yên Minh',
    category: 'nature',
    elevation: 980,
    distanceFromStart: 85,
    difficulty: 'Dễ đi',
    bestTime: '14:00 - 17:00 (Nắng xiên qua tán thông)',
    highlights: ['"Đà Lạt thu nhỏ" trên cao nguyên đá', 'Cung đường thông xanh rợp bóng mát rượi', 'Điểm dừng chân picnic nghỉ trưa lý tưởng'],
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200&auto=format&fit=crop'
    ],
    description: 'Những cánh rừng thông bạt ngàn trải dài hai bên triền núi thoai thoải, mang lại cảm giác thư thái, dịu mát sau khi vượt qua những con dốc đá hiểm trở.',
    safetyTip: 'Lưu ý lá thông khô rụng trên mặt đường có thể gây trơn trượt nhẹ khi vào cua gấp.',
    coordinates: { x: 420, y: 360, lat: 23.1167, lng: 105.1500 },
    recommendedStayHours: 1.5,
    localFood: ['Bánh cuốn trứng Yên Minh', 'Xôi ngũ sắc dẻo thơm']
  }
];

export const PRESET_ITINERARIES: DayItinerary[][] = [
  // 3 Days 2 Nights Classic Loop
  [
    {
      day: 1,
      title: 'Chinh phục Cổng Trời Quản Bạ & Thung lũng Yên Minh',
      theme: 'Bắt đầu hành trình từ phố thị lên miền đá',
      startPoint: 'TP Hà Giang (Km 0)',
      endPoint: 'Thị trấn Đồng Văn',
      totalDistanceKm: 145,
      ridingHours: 4.5,
      maxElevationM: 1500,
      scenicRating: 5,
      weatherAlert: 'Sáng sớm có sương mù nhẹ tại Dốc Bắc Sum',
      waypoints: [
        {
          id: 'w1-1',
          day: 1,
          time: '07:30',
          title: 'Cột mốc Km 0 Hà Giang',
          subtitle: 'Khởi động và kiểm tra áp suất lốp, phanh xe',
          distanceKm: 0,
          elevationM: 110,
          type: 'ride',
          highlight: 'Điểm xuất phát chính thức của cung đường huyền thoại',
          aiTip: 'Đổ đầy bình xăng tại cây xăng trung tâm trước khi bắt đầu leo dốc QL4C.'
        },
        {
          id: 'w1-2',
          day: 1,
          time: '09:15',
          title: 'Cổng Trời Quản Bạ & Núi Đôi',
          subtitle: 'Ngắm nhìn thung lũng Tam Sơn và săn mây',
          distanceKm: 46,
          elevationM: 1500,
          type: 'viewpoint',
          highlight: 'Cửa ngõ dẫn vào Công viên địa chất toàn cầu UNESCO',
          aiTip: 'Ghé quán cà phê trên đài vọng cảnh để có góc máy bao quát trọn đôi gò bồng đảo Cô Tiên.'
        },
        {
          id: 'w1-3',
          day: 1,
          time: '12:00',
          title: 'Ăn trưa tại Thị trấn Yên Minh',
          subtitle: 'Thưởng thức phở Tráng Kìm và nghỉ ngơi',
          distanceKm: 85,
          elevationM: 700,
          type: 'meal',
          highlight: 'Nạp năng lượng sau chặng đèo thông mát rượi',
          aiTip: 'Nghỉ ngơi tối thiểu 45 phút cho máy xe nguội bớt trước chặng Dốc Thẩm Mã buổi chiều.'
        },
        {
          id: 'w1-4',
          day: 1,
          time: '14:30',
          title: 'Vượt Dốc Thẩm Mã & Ghé Dinh Vua Mèo',
          subtitle: 'Check-in 9 khúc cua tay áo và kiến trúc Sa Mộc đá xanh',
          distanceKm: 125,
          elevationM: 1200,
          type: 'culture',
          highlight: 'Khám phá bí ẩn lịch sử dòng họ Vương quyền lực thế kỷ 20',
          aiTip: 'Mua vé tham quan 30k/người, nên thuê hướng dẫn viên bản địa thuyết minh câu chuyện lịch sử hào hùng.'
        },
        {
          id: 'w1-5',
          day: 1,
          time: '17:30',
          title: 'Đến Phố Cổ Đồng Văn',
          subtitle: 'Nhận phòng homestay, dạo phố cổ và ăn cháo ấu tẩu',
          distanceKm: 145,
          elevationM: 1050,
          type: 'stay',
          highlight: 'Không gian đèn lồng cổ xưa và chén rượu ngô ấm nồng',
          aiTip: 'Ăn cháo ấu tẩu vào buổi tối giúp thư giãn cơ bắp sau ngày dài lái xe vượt đèo.'
        }
      ],
      eveningStay: {
        name: 'Bụi Homestay Đồng Văn / Lô Lô Chải Village',
        type: 'Nhà trình tường truyền thống',
        vibe: 'Ấm cúng, mộc mạc, view nương ngô',
        priceEstimate: '350.000đ - 650.000đ/đêm'
      }
    },
    {
      day: 2,
      title: 'Đỉnh Mã Pí Lèng, Hẻm Tu Sản & Hẻm Vực Mèo Vạc',
      theme: 'Trái tim hùng vĩ nhất của đại ngàn Hà Giang',
      startPoint: 'Phố Cổ Đồng Văn',
      endPoint: 'Bản Tiên Du Già hoặc Mèo Vạc',
      totalDistanceKm: 95,
      ridingHours: 3.5,
      maxElevationM: 1520,
      scenicRating: 5,
      weatherAlert: 'Thời tiết đỉnh đèo gió lớn, nhiệt độ chênh lệch 5°C',
      waypoints: [
        {
          id: 'w2-1',
          day: 2,
          time: '07:00',
          title: 'Ngắm bình minh Lô Lô Chải & Cột Cờ Lũng Cú',
          subtitle: 'Chạm tay vào điểm Cực Bắc thiêng liêng',
          distanceKm: 25,
          elevationM: 1470,
          type: 'culture',
          highlight: 'Lá cờ 54m² tung bay lộng gió nơi địa đầu',
          aiTip: 'Uống cà phê Cực Bắc tại nhà sàn cổ của người Lô Lô Đen.'
        },
        {
          id: 'w2-2',
          day: 2,
          time: '10:30',
          title: 'Chinh phục Đèo Mã Pí Lèng',
          subtitle: 'Ngắm nhìn Hẻm Tu Sản từ độ cao 1.500m',
          distanceKm: 55,
          elevationM: 1520,
          type: 'viewpoint',
          highlight: 'Một trong những cung đèo ngoạn mục nhất thế giới',
          aiTip: 'Dừng tại tượng đài Thanh Niên Xung Phong để tri ân những người mở đường Hạnh Phúc.'
        },
        {
          id: 'w2-3',
          day: 2,
          time: '13:30',
          title: 'Đi thuyền trên Sông Nho Quế',
          subtitle: 'Lướt sóng giữa hẻm vực đá vôi dựng đứng sâu 800m',
          distanceKm: 65,
          elevationM: 450,
          type: 'ride',
          highlight: 'Màu nước xanh ngọc lam kỳ ảo soi bóng vách đá khổng lồ',
          aiTip: 'Thuê dịch vụ xe ôm bản địa đưa xuống bến thuyền Tà Làng để đảm bảo an toàn tuyệt đối.'
        },
        {
          id: 'w2-4',
          day: 2,
          time: '17:00',
          title: 'Về bản Du Già qua Cua Chữ M',
          subtitle: 'Trải nghiệm cung đường hoang sơ Mậu Duệ',
          distanceKm: 95,
          elevationM: 800,
          type: 'stay',
          highlight: 'Cảnh sắc núi đá tai mèo trùng điệp vắng bóng khói bụi',
          aiTip: 'Kiểm tra bình xăng tại thị trấn Mèo Vạc trước khi rẽ vào đường Mậu Duệ.'
        }
      ],
      eveningStay: {
        name: 'Du Già Panorama Homestay / Du Già Waterfall Lodge',
        type: 'Nhà sàn gỗ người Tày bên suối',
        vibe: 'Hoang sơ, suối reo, tiệc nướng BBQ địa phương',
        priceEstimate: '300.000đ - 550.000đ/đêm'
      }
    },
    {
      day: 3,
      title: 'Tắm Thác Ba Tiên & Vòng Cung Trở Về TP Hà Giang',
      theme: 'Thư giãn suối mát và hoàn thành vòng cung kỳ vĩ',
      startPoint: 'Bản Du Già',
      endPoint: 'TP Hà Giang',
      totalDistanceKm: 75,
      ridingHours: 3.0,
      maxElevationM: 950,
      scenicRating: 5,
      weatherAlert: 'Đường tỉnh lộ 176 có đoạn đường đất gồ ghề',
      waypoints: [
        {
          id: 'w3-1',
          day: 3,
          time: '08:00',
          title: 'Tắm thác Ba Tiên Du Già',
          subtitle: 'Ngâm mình trong làn nước suối mát trong veo',
          distanceKm: 5,
          elevationM: 780,
          type: 'viewpoint',
          highlight: 'Thác nước tự nhiên xanh ngắt mát lạnh',
          aiTip: 'Mang theo quần áo bơi và dép bám đá chống trượt khi xuống thác.'
        },
        {
          id: 'w3-2',
          day: 3,
          time: '11:00',
          title: 'Ăn trưa cơm lam gà đồi nướng Du Già',
          subtitle: 'Thưởng thức ẩm thực bản địa bên nếp nhà sàn',
          distanceKm: 10,
          elevationM: 750,
          type: 'meal',
          highlight: 'Vị ngọt bùi của gạo nếp nương và rau rừng chấm chẩm chéo',
          aiTip: 'Uống thử một chén nhỏ trà thảo mộc hoa tam giác mạch thơm mát.'
        },
        {
          id: 'w3-3',
          day: 3,
          time: '13:30',
          title: 'Đường về qua Thuận Hòa - Sông Miện',
          subtitle: 'Xuôi thung lũng dọc theo dòng sông Miện êm đềm',
          distanceKm: 55,
          elevationM: 400,
          type: 'ride',
          highlight: 'Những nương lúa nước phẳng lặng và cầu treo lắc lư',
          aiTip: 'Đoạn đường cuối khá êm ái, duy trì tốc độ 40km/h để ngắm cảnh chiều tà.'
        },
        {
          id: 'w3-4',
          day: 3,
          time: '16:30',
          title: 'Về đích Cột mốc Km 0 TP Hà Giang',
          subtitle: 'Trả xe máy, nhận chứng nhận hoàn thành Hà Giang Loop',
          distanceKm: 75,
          elevationM: 110,
          type: 'stay',
          highlight: 'Khoảnh khắc tự hào chinh phục hơn 350km đèo núi cao nguyên đá',
          aiTip: 'Tắm nước lá thuốc người Dao đỏ tại TP Hà Giang để hồi phục cơ thể trước khi lên xe giường nằm về Hà Nội.'
        }
      ],
      eveningStay: {
        name: 'Hà Giang Eco Lodge / Xe Limousine về Hà Nội',
        type: 'Trung tâm nghỉ dưỡng / Xe giường nằm cao cấp',
        vibe: 'Thoải mái, tiện nghi, hồi phục sức khỏe',
        priceEstimate: '250.000đ - 450.000đ'
      }
    }
  ]
];

export const PASS_WEATHER_STATION: WeatherPassStatus[] = [
  {
    location: 'Đỉnh Đèo Mã Pí Lèng',
    elevation: 1520,
    temp: 18,
    condition: 'Nắng nhẹ, gió đại ngàn 18km/h',
    windSpeedKm: 18,
    fogLevel: 'Quang đãng',
    roadStatus: 'An toàn',
    updatedAt: 'Vừa cập nhật 5 phút trước'
  },
  {
    location: 'Cổng Trời Quản Bạ',
    elevation: 1500,
    temp: 17,
    condition: 'Sương mù mây trôi thung lũng',
    windSpeedKm: 14,
    fogLevel: 'Sương mù nhẹ',
    roadStatus: 'Lưu ý cua dốc',
    updatedAt: 'Vừa cập nhật 12 phút trước'
  },
  {
    location: 'Dốc Thẩm Mã (Yên Minh)',
    elevation: 1100,
    temp: 21,
    condition: 'Trời quang, tầm nhìn xa > 10km',
    windSpeedKm: 9,
    fogLevel: 'Quang đãng',
    roadStatus: 'An toàn',
    updatedAt: 'Vừa cập nhật 18 phút trước'
  },
  {
    location: 'Cột Cờ Cực Bắc Lũng Cú',
    elevation: 1470,
    temp: 16,
    condition: 'Gió mạnh cấp 4, se lạnh',
    windSpeedKm: 26,
    fogLevel: 'Quang đãng',
    roadStatus: 'An toàn',
    updatedAt: 'Vừa cập nhật 2 phút trước'
  },
  {
    location: 'Thác Nước Du Già',
    elevation: 780,
    temp: 24,
    condition: 'Nắng ráo ấm áp, nước suối trong xanh',
    windSpeedKm: 6,
    fogLevel: 'Quang đãng',
    roadStatus: 'Đường ướt trơn',
    updatedAt: 'Vừa cập nhật 8 phút trước'
  }
];

export const GEAR_CHECKLIST: GearItem[] = [
  { id: 'g1', name: 'Giáp bảo hộ tay chân 4 món (Inox hoặc đệm carbon)', category: 'safety', recommended: true, checked: true, note: 'Bắt buộc khi phượt xe máy đường đèo đá' },
  { id: 'g2', name: 'Mũ bảo hiểm 3/4 hoặc Fullface đạt chuẩn DOT/ECE', category: 'safety', recommended: true, checked: true, note: 'Tránh dùng mũ nửa đầu thời trang' },
  { id: 'g3', name: 'Găng tay lái xe có gù bảo vệ & chống trượt', category: 'safety', recommended: true, checked: true, note: 'Giữ ấm và tăng độ bám tay ga khi trời mưa sương' },
  { id: 'g4', name: 'Bộ quần áo mưa rời 2 lớp chống gió lạnh', category: 'clothing', recommended: true, checked: true, note: 'Thời tiết Hà Giang trên cao thay đổi rất nhanh' },
  { id: 'g5', name: 'Áo khoác gió giữ nhiệt & áo len mỏng lót trong', category: 'clothing', recommended: true, checked: false, note: 'Nhiệt độ ban đêm tại Đồng Văn thường xuống 12-15°C' },
  { id: 'g6', name: 'Giày thể thao có gai bám hoặc giày trekking chống nước', category: 'clothing', recommended: true, checked: false, note: 'Không đi dép tông hoặc giày đế trơn khi leo dốc' },
  { id: 'g7', name: 'Túi bọc balo chống nước & túi chống nước điện thoại', category: 'electronics', recommended: true, checked: true, note: 'Rất cần thiết khi đi thuyền sông Nho Quế & thác Du Già' },
  { id: 'g8', name: 'Pin sạc dự phòng dung lượng cao (20.000mAh)', category: 'electronics', recommended: true, checked: false, note: 'Sóng 4G yếu trên đèo làm điện thoại tụt pin nhanh hơn' },
  { id: 'g9', name: 'Túi thuốc cá nhân (Panadol, Berberin, Salonpas, Băng gạc urgo)', category: 'medical', recommended: true, checked: false, note: 'Hiệu thuốc trên đường đèo cách xa nhau hàng chục km' },
  { id: 'g10', name: 'Căn cước công dân / Hộ chiếu & Bằng lái xe A1/A2 hợp lệ', category: 'documents', recommended: true, checked: true, note: 'Cần thiết để xuất trình tại điểm lưu trú & thuê xe' }
];

export const HOMESTAYS: HomestaySpot[] = [
  {
    id: 'hs-1',
    name: 'Lô Lô Chải Homestay & Ancient Lodge',
    location: 'Bản Lô Lô Chải, xã Lũng Cú, Đồng Văn',
    pricePerNight: 450000,
    rating: 4.95,
    reviewCount: 284,
    imageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?q=80&w=800&auto=format&fit=crop',
    tags: ['Nhà trình tường cổ', 'Dưới chân cột cờ', 'Gần Cà phê Cực Bắc', 'Sưởi củi'],
    highlight: 'Nếp nhà đất vàng 100 năm tuổi của người Lô Lô, không gian cổ tích yên bình.',
    phone: '0984 223 889'
  },
  {
    id: 'hs-2',
    name: 'Mã Pí Lèng Ecolodge & Panorama Valley',
    location: 'Thôn Pả Vi Hạ, Mèo Vạc (chân đèo)',
    pricePerNight: 650000,
    rating: 4.9,
    reviewCount: 340,
    imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=800&auto=format&fit=crop',
    tags: ['View Hẻm Tu Sản', 'Làng văn hoá Pả Vi', 'Phòng tắm kính view núi'],
    highlight: 'Ngắm biển mây sớm tràn qua thung lũng Pả Vi ngay từ ban công phòng ngủ.',
    phone: '0912 345 678'
  },
  {
    id: 'hs-3',
    name: 'Du Già Waterfall Homestay & Peace Haven',
    location: 'Làng Cốc Pảng, Du Già, Yên Minh',
    pricePerNight: 350000,
    rating: 4.85,
    reviewCount: 198,
    imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?q=80&w=800&auto=format&fit=crop',
    tags: ['Gần thác Ba Tiên', 'Ăn tối mâm cơm người Tày', 'Tắm suối', 'Nhạc sống'],
    highlight: 'Nhà sàn gỗ lim truyền thống bên bờ suối róc rách, tiệc nướng đầm ấm.',
    phone: '0977 123 456'
  },
  {
    id: 'hs-4',
    name: 'Bụi Homestay Đồng Văn Central',
    location: 'Tổ 2, Thị trấn Đồng Văn',
    pricePerNight: 400000,
    rating: 4.88,
    reviewCount: 412,
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop',
    tags: ['Trung tâm phố cổ', 'Tiệm cà phê acoustic', 'Hỗ trợ sửa xe & phượt'],
    highlight: 'Đi bộ 3 phút ra chợ phiên và phố cổ Đồng Văn, không gian phượt thủ thân thiện.',
    phone: '0966 888 999'
  }
];
