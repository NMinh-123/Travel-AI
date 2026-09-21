import type { WebsiteDestination } from "@data/website/types";

/** Researched in dia_danh.md. Coordinates and elevations mirror data/places/geography.ts exactly;
 * the confidence level travels with them as Destination.locationPrecision, derived from that store.
 * A place with no geo entry there keeps lat/lng null. Road distances stay null until verified. */
export const EXPANDED_DESTINATIONS: WebsiteDestination[] = [
  {
    "slug": "thon-tha",
    "name": "Tha Village",
    "vietnameseName": "Làng văn hóa du lịch Thôn Tha",
    "regionLabel": "Hà Giang – Vị Xuyên",
    "category": "culture",
    "elevation": 120,
    "distanceFromStart": null,
    "difficulty": "Dễ đi",
    "bestTime": "Quanh năm; gợi ý sáng hoặc cuối chiều, hỏi lịch mùa lúa tại chỗ",
    "highlights": [
      "Kiến trúc nhà sàn mái lá cọ",
      "Cảnh đồng ruộng quanh làng",
      "Trải nghiệm nấu ăn và sinh hoạt tại homestay khi chủ nhà có tổ chức"
    ],
    "description": "Thôn Tha là điểm tìm hiểu đời sống người Tày ở gần đô thị Hà Giang. Nhà sàn mái lá cọ, ruộng và hệ thống nước trong làng tạo nên một không gian phù hợp với chuyến đi chậm, có thời gian trò chuyện cùng người dân.",
    "safetyTip": "Xin phép trước khi vào nhà hoặc chụp chân dung. Đường bờ ruộng có thể trơn sau mưa; đi theo lối có sẵn.",
    "lat": 22.81,
    "lng": 104.95,
    "recommendedStayHours": 2.5,
    "localFood": [
      "Cơm lam",
      "Gà đồi",
      "Cá bỗng nấu măng chua"
    ],
    "imageSlug": "thon-tha",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: TITC — Làng văn hóa du lịch cộng đồng Thôn Tha",
        "url": "https://dantoc.vietnamtourism.gov.vn/lang-van-hoa-du-lich-cong-dong-thon-tha/"
      },
      {
        "title": "TITC — Bình dị Thôn Tha",
        "url": "https://nongthon.vietnamtourism.gov.vn/binh-di-lang-van-hoa-du-lich-cong-dong-thon-tha-ha-giang/"
      }
    ],
    "sortOrder": 13
  },
  {
    "slug": "ho-noong",
    "name": "Noong Lake",
    "vietnameseName": "Hồ Noong",
    "regionLabel": "Hà Giang – Vị Xuyên",
    "category": "nature",
    "elevation": 200,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Ngày khô ráo, sáng hoặc cuối chiều; hỏi tình trạng nước trước khi đi",
    "highlights": [
      "Không gian hồ và vùng dân cư quanh hồ",
      "Góc quan sát mặt nước khi điều kiện phù hợp",
      "Lựa chọn tham quan nhẹ nhàng ngoài tuyến cao nguyên đá"
    ],
    "description": "Hồ Noong phù hợp với người muốn thêm một điểm cảnh quan nước vào chuyến Hà Giang. Tuy nhiên, hình ảnh rừng cây ngập nước thường thấy trong tư liệu cũ không bảo đảm còn giống hiện trạng: Báo Hà Giang đã phản ánh sự biến đổi mạnh của cảnh quan vào năm 2019.",
    "safetyTip": "Không mặc định có thuyền phục vụ hoặc được phép bơi. Tránh bờ bùn, đoạn nước sâu và khu vực không có người quản lý.",
    "lat": 22.7519,
    "lng": 105.0353,
    "recommendedStayHours": 1.5,
    "localFood": [
      "Bữa cơm gia đình đặt trước",
      "Cá và rau theo nguồn địa phương"
    ],
    "imageSlug": "ho-noong",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Báo Hà Giang — Hồ Noong chỉ còn trong tiềm thức!",
        "url": "https://baohagiang.vn/van-hoa/201904/ho-noong-chi-con-trong-tiem-thuc-743640/"
      },
      {
        "title": "phóng sự du lịch hồ Noong năm 2024",
        "url": "https://baohagiang.vn/multimedia/truyen-hinh/202409/ho-noong-diem-du-lich-yen-binh-tho-mong-8ce4df0/"
      }
    ],
    "sortOrder": 14
  },
  {
    "slug": "ban-nam-dam",
    "name": "Nam Dam Cultural Village",
    "vietnameseName": "Làng văn hóa du lịch Nặm Đăm",
    "regionLabel": "Quản Bạ",
    "category": "culture",
    "elevation": 1050,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Quanh năm; chọn ngày khô để đi bộ, buổi chiều nếu nghỉ lại",
    "highlights": [
      "Giao lưu với gia đình người Dao",
      "Trải nghiệm bữa cơm nhà",
      "Nghỉ lại để khám phá Quản Bạ thong thả hơn"
    ],
    "description": "Nặm Đăm phát triển du lịch cộng đồng dựa vào văn hóa người Dao và dịch vụ lưu trú tại nhà dân. Khách có thể tìm hiểu sinh hoạt, ẩm thực và các sản phẩm thảo dược địa phương qua hoạt động do hộ đón khách tổ chức.",
    "safetyTip": "Hỏi trước hoạt động nào thực sự được tổ chức. Tắm lá thuốc là dịch vụ trải nghiệm, không nên coi là phương pháp điều trị; báo dị ứng cho cơ sở nếu sử dụng.",
    "lat": 23.07,
    "lng": 104.97,
    "recommendedStayHours": 2.5,
    "localFood": [
      "Cơm gia đình người Dao",
      "Gà bản",
      "Rau theo mùa"
    ],
    "imageSlug": "ban-nam-dam",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Cục Du lịch Quốc gia Việt Nam — Du lịch xanh bền vững",
        "url": "https://vietnamtourism.gov.vn/post/65431"
      }
    ],
    "sortOrder": 15
  },
  {
    "slug": "lang-det-lanh-lung-tam",
    "name": "Lung Tam Linen Weaving Village",
    "vietnameseName": "Làng dệt lanh Lùng Tám",
    "regionLabel": "Quản Bạ",
    "category": "culture",
    "elevation": 900,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Quanh năm; ban ngày và nên liên hệ trước để xem quy trình làm nghề",
    "highlights": [
      "Xem dệt bằng khung cửi",
      "Nghe giải thích quy trình làm vải lanh",
      "Chọn mua sản phẩm trực tiếp tại cơ sở làm nghề"
    ],
    "description": "Lùng Tám giúp du khách hiểu công sức phía sau một tấm vải lanh của người Mông. Quy trình thủ công gồm nhiều bước xử lý sợi, dệt và hoàn thiện vải; hợp tác xã vừa bảo tồn nghề vừa giới thiệu sản phẩm cho khách.",
    "safetyTip": "Không tự vận hành khung dệt hoặc chạm vào vật liệu đang xử lý. Xin phép trước khi chụp nghệ nhân; hỏi rõ phí nếu có hoạt động thực hành.",
    "lat": 22.9989,
    "lng": 104.9317,
    "recommendedStayHours": 1.5,
    "localFood": [
      "Phở Tráng Kìm",
      "Hồng không hạt Quản Bạ theo mùa"
    ],
    "imageSlug": "lang-det-lanh-lung-tam",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: TITC — Làng dệt thổ cẩm người Mông Lùng Tám",
        "url": "https://dantoc.vietnamtourism.gov.vn/lang-det-tho-cam-nguoi-mong-lung-tam-ha-giang/"
      }
    ],
    "sortOrder": 16
  },
  {
    "slug": "dong-lung-khuy",
    "name": "Lung Khuy Cave",
    "vietnameseName": "Động Lùng Khúy",
    "regionLabel": "Quản Bạ",
    "category": "nature",
    "elevation": null,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Ban ngày, ưu tiên hôm khô ráo; xác nhận mở cửa trước khi rẽ vào",
    "highlights": [
      "Các khối nhũ đá đa dạng",
      "Quan sát cảnh quan đá vôi trong lòng núi",
      "Thay đổi nhịp trải nghiệm sau các điểm ngắm ngoài trời"
    ],
    "description": "Lùng Khúy bổ sung trải nghiệm trong lòng núi đá vôi cho hành trình Quản Bạ. Hệ thống nhũ đá và măng đá là điểm thu hút chính. Số liệu khảo sát được báo dẫn cho chiều dài động là 517,5 m; không nên nhầm chiều dài khảo sát với quãng đường khách được phép đi.",
    "safetyTip": "Mang giày bám tốt, bám tay vịn, không chạm hoặc bẻ nhũ đá. Chỉ đi tuyến được mở cho khách; cân nhắc sức khỏe đầu gối khi lên xuống bậc.",
    "lat": null,
    "lng": null,
    "recommendedStayHours": 2,
    "localFood": [
      "Phở ở Tam Sơn",
      "Cơm địa phương ở Tam Sơn"
    ],
    "imageSlug": "dong-lung-khuy",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: VietnamNet — Động Lùng Khuý",
        "url": "https://vietnamnet.vn/ngo-ngang-truoc-ve-dep-nguyen-so-cua-cao-nguyen-de-nhat-dong-lung-khuy-2336600.html"
      }
    ],
    "sortOrder": 17
  },
  {
    "slug": "sung-la",
    "name": "Sung La Valley and Lung Cam Village",
    "vietnameseName": "Thung lũng Sủng Là – làng Lũng Cẩm",
    "regionLabel": "Đồng Văn",
    "category": "culture",
    "elevation": 1100,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Đầu xuân để tìm hoa cải, đào, lê; mùa hoa khác phụ thuộc lịch gieo trồng",
    "highlights": [
      "Nhà trình tường và mái ngói âm dương",
      "Đi bộ trong làng Lũng Cẩm, nơi có ngôi nhà được chọn làm bối cảnh phim “Chuyện của Pao”",
      "Cảnh ruộng và hoa khi đúng vụ"
    ],
    "description": "Sủng Là có các nếp nhà giữa ruộng canh tác và núi đá. Ngôi nhà thường gọi là nhà của Pao là một điểm tham quan nổi tiếng trong hành trình khám phá thung lũng. Cảnh hoa đầu xuân là một nét đặc trưng được nguồn du lịch ghi nhận.",
    "safetyTip": "Hỏi phí và phạm vi được tham quan. Không bước vào luống hoa hoặc sân nhà riêng khi chưa được đồng ý.",
    "lat": 23.25806,
    "lng": 105.24861,
    "recommendedStayHours": 2,
    "localFood": [
      "Bánh tam giác mạch",
      "Mèn mén"
    ],
    "imageSlug": "sung-la",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Cục Du lịch Quốc gia Việt Nam — Sủng Là, thung lũng mùa xuân",
        "url": "https://vietnamtourism.gov.vn/post/36539"
      },
      {
        "title": "Nguồn: TITC — Đến Hà Giang ghé thăm Sủng Là",
        "url": "https://dantoc.vietnamtourism.gov.vn/den-ha-giang-ghe-tham-sung-la/"
      }
    ],
    "sortOrder": 18
  },
  {
    "slug": "ban-lo-lo-chai",
    "name": "Lo Lo Chai Village",
    "vietnameseName": "Bản Lô Lô Chải",
    "regionLabel": "Đồng Văn",
    "category": "culture",
    "elevation": 1450,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Quanh năm; gợi ý buổi sáng hoặc cuối chiều, chuẩn bị áo ấm mùa lạnh",
    "highlights": [
      "Kiến trúc nhà trình tường và hàng rào đá",
      "Tìm hiểu trang phục và đời sống qua người giới thiệu địa phương",
      "Nghỉ lại trong bản, gần cột cờ Lũng Cú"
    ],
    "description": "Lô Lô Chải là làng dưới chân núi Rồng, nổi bật với nhà trình tường, mái ngói âm dương và hàng rào đá. Du lịch cộng đồng tạo cơ hội tìm hiểu văn hóa người Lô Lô qua lưu trú và giao lưu với người dân.",
    "safetyTip": "Giữ yên tĩnh trong ngõ, không tự vào khu thờ cúng. Xin phép khi chụp người dân và không coi sinh hoạt gia đình là buổi biểu diễn.",
    "lat": 23.36,
    "lng": 105.3247,
    "recommendedStayHours": 2.5,
    "localFood": [
      "Cơm gia đình",
      "Thịt và rau theo mùa"
    ],
    "imageSlug": "ban-lo-lo-chai",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Chuyên trang du lịch nông thôn — Lô Lô Chải",
        "url": "https://nongthon.vietnamtourism.gov.vn/du-lich-lo-lo-chai-ha-giang-khi-ban-sac-truyen-thong-va-cong-nghe-hien-dai-gap-nhau/"
      }
    ],
    "sortOrder": 19
  },
  {
    "slug": "lang-van-hoa-pa-vi-ha",
    "name": "Pa Vi Ha Hmong Cultural Village",
    "vietnameseName": "Làng văn hóa du lịch Pả Vi Hạ",
    "regionLabel": "Mèo Vạc",
    "category": "culture",
    "elevation": null,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Quanh năm; gợi ý cuối chiều và nghỉ đêm",
    "highlights": [
      "Không gian kiến trúc gắn với văn hóa Mông",
      "Đi dạo trong thung lũng Pả Vi",
      "Điểm nghỉ trên hành trình qua Mèo Vạc"
    ],
    "description": "Pả Vi Hạ là làng du lịch cộng đồng người Mông trong thung lũng Pả Vi, nằm trên trục Quốc lộ 4C. Đây là không gian du lịch được xây dựng có chủ đích; nên giới thiệu đúng tính chất thay vì gọi toàn bộ khu là làng cổ nguyên trạng.",
    "safetyTip": "Hỏi rõ giá phòng, bữa ăn và hoạt động giao lưu trước khi đặt. Không mặc định tối nào cũng có chương trình văn nghệ.",
    "lat": null,
    "lng": null,
    "recommendedStayHours": 2,
    "localFood": [
      "Mèn mén",
      "Thịt lợn bản",
      "Rau theo mùa"
    ],
    "imageSlug": "lang-van-hoa-pa-vi-ha",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Chuyên trang du lịch nông thôn — Thung lũng Pả Vi",
        "url": "https://nongthon.vietnamtourism.gov.vn/co-mot-thao-nguyen-xanh-giua-long-meo-vac-ha-giang/"
      }
    ],
    "sortOrder": 20
  },
  {
    "slug": "cho-tinh-khau-vai",
    "name": "Khau Vai Love Market",
    "vietnameseName": "Chợ phong lưu Khâu Vai, thường gọi chợ tình Khâu Vai",
    "regionLabel": "Mèo Vạc",
    "category": "culture",
    "elevation": 700,
    "distanceFromStart": null,
    "difficulty": "Đòi hỏi tay lái vững",
    "bestTime": "Dịp truyền thống đêm 26, ngày 27 tháng 3 âm lịch; xác nhận lịch tổ chức từng năm",
    "highlights": [
      "Tìm hiểu câu chuyện chợ phong lưu",
      "Không khí gặp gỡ dịp hội",
      "Trang phục và sinh hoạt văn hóa của các cộng đồng tham dự"
    ],
    "description": "Khâu Vai nổi tiếng với cuộc gặp gỡ mang ý nghĩa tình cảm và văn hóa, gắn với truyền thuyết đôi trai gái khác cộng đồng. Giá trị chính nằm ở dịp sinh hoạt truyền thống; tới ngoài mùa hội sẽ có trải nghiệm rất khác.",
    "safetyTip": "Không coi đây là chợ họp hằng ngày. Giữ đồ cá nhân lúc đông người, hỏi chỗ đỗ xe; không uống rượu nếu còn lái xe.",
    "lat": 23.0664,
    "lng": 105.4869,
    "recommendedStayHours": 3,
    "localFood": [
      "Thắng cố",
      "Mèn mén"
    ],
    "imageSlug": "cho-tinh-khau-vai",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: TITC — Khau Vai Love Market",
        "url": "https://vietnamtourism.vn/en/index.php/tourism/items/2897"
      }
    ],
    "sortOrder": 21
  },
  {
    "slug": "dinh-chieu-lau-thi",
    "name": "Chieu Lau Thi Peak",
    "vietnameseName": "Đỉnh Chiêu Lầu Thi",
    "regionLabel": "Hoàng Su Phì",
    "category": "nature",
    "elevation": 2402,
    "distanceFromStart": null,
    "difficulty": "Đòi hỏi tay lái vững",
    "bestTime": "Chọn ngày khô, tầm nhìn tốt; mây và bình minh phụ thuộc thời tiết, không bảo đảm",
    "highlights": [
      "Đi bộ lên núi cao",
      "Quan sát cảnh rừng trên đường lên",
      "Ngắm các lớp núi khi trời mở"
    ],
    "description": "Chiêu Lầu Thi là điểm núi cao ở vùng Hồ Thầu, phù hợp với người muốn thêm hoạt động đi bộ vào hành trình phía Tây Hà Giang. Rừng và tầm nhìn từ đỉnh là sức hút chính; biển mây chỉ xuất hiện khi điều kiện phù hợp.",
    "safetyTip": "Xác nhận đường tiếp cận với người dẫn địa phương; mang áo ấm, áo mưa, nước và giày bám tốt. Không tiếp tục lên đỉnh khi có dông hoặc tầm nhìn quá kém.",
    "lat": null,
    "lng": null,
    "recommendedStayHours": 4,
    "localFood": [
      "Cơm gia đình vùng Hồ Thầu",
      "Rau địa phương",
      "Chè Shan tuyết"
    ],
    "imageSlug": "dinh-chieu-lau-thi",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Cục Du lịch Quốc gia Việt Nam — Hồ Thầu",
        "url": "https://vietnamtourism.vn/index.php/news/items/25225"
      },
      {
        "title": "VOV — Chinh phục Chiêu Lầu Thi 2.402 m",
        "url": "https://vov.gov.vn/chinh-phuc-dinh-chieu-lau-thi-2402m-bong-benh-giua-bien-may-dtnew-226889?keyDevice=true"
      }
    ],
    "sortOrder": 22
  },
  {
    "slug": "thac-tien-deo-gio",
    "name": "Tien Waterfall and Deo Gio Forest",
    "vietnameseName": "Thác Tiên – Đèo Gió",
    "regionLabel": "Xín Mần",
    "category": "waterfall",
    "elevation": 1100,
    "distanceFromStart": null,
    "difficulty": "Đòi hỏi tay lái vững",
    "bestTime": "Ngày khô ráo, ban ngày; không chọn lúc đang mưa lớn chỉ vì thác nhiều nước",
    "highlights": [
      "Thác nước giữa rừng Đèo Gió",
      "Đi bộ theo lối tham quan",
      "Chụp cảnh nước từ vị trí được phép"
    ],
    "description": "Thác Tiên nằm trong không gian rừng Đèo Gió ở Nấm Dẩn. Dòng nước chia nhánh giữa nền rừng tạo nên trải nghiệm khác với cảnh núi đá phía Đồng Văn. Có thể kết hợp tìm hiểu bãi đá cổ Nấm Dẩn trong cùng hành trình khu vực.",
    "safetyTip": "Mặt đá và bậc xuống có thể trơn. Không leo ra dòng chảy hoặc tự bơi dưới thác; tuân thủ rào chắn và hướng dẫn tại chỗ.",
    "lat": 22.58091,
    "lng": 104.49356,
    "recommendedStayHours": 2,
    "localFood": [
      "Cơm địa phương ở Nấm Dẩn",
      "Cơm địa phương ở Cốc Pài"
    ],
    "imageSlug": "thac-tien-deo-gio",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: TITC — Thác Tiên – Đèo Gió",
        "url": "https://nongthon.vietnamtourism.gov.vn/ve-dep-yen-binh-tho-mong-cua-thac-tien-deo-gio-ha-giang/"
      }
    ],
    "sortOrder": 23
  },
  {
    "slug": "bai-da-co-nam-dan",
    "name": "Nam Dan Ancient Rock Field",
    "vietnameseName": "Bãi đá cổ Nấm Dẩn",
    "regionLabel": "Xín Mần",
    "category": "culture",
    "elevation": null,
    "distanceFromStart": null,
    "difficulty": "Trung bình",
    "bestTime": "Ban ngày, thời tiết khô; tránh lúc suối dâng hoặc đường bùn trơn",
    "highlights": [
      "Quan sát hình khắc cổ trên các khối đá",
      "Tìm hiểu mối liên hệ giữa di tích và cảnh quan",
      "Kết hợp khám phá văn hóa vùng Nấm Dẩn"
    ],
    "description": "Bãi đá cổ Nấm Dẩn lưu giữ các hình khắc trên những khối đá trong thung lũng. Đây là điểm phù hợp với người thích khảo cổ và lịch sử văn hóa. Niên đại, tác giả và ý nghĩa của từng hình khắc cần được trình bày theo nghiên cứu, không kể giả thuyết như kết luận chắc chắn.",
    "safetyTip": "Không tô phấn, đổ nước, khắc thêm hay giẫm lên hình khắc để chụp ảnh. Nếu đường tiếp cận phải qua suối, hỏi người quản lý và không lội khi nước lên.",
    "lat": null,
    "lng": null,
    "recommendedStayHours": 1.5,
    "localFood": [
      "Bữa cơm người Nùng ở Nấm Dẩn",
      "Rau theo mùa"
    ],
    "imageSlug": "bai-da-co-nam-dan",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: TITC — Vẻ đẹp bí ẩn của bãi đá cổ Nấm Dẩn",
        "url": "https://nongthon.vietnamtourism.gov.vn/ve-dep-bi-an-cua-bai-da-co-nam-dan-ha-giang/"
      }
    ],
    "sortOrder": 24
  },
  {
    "slug": "thao-nguyen-suoi-thau",
    "name": "Suoi Thau Grassland",
    "vietnameseName": "Thảo nguyên Suôi Thầu",
    "regionLabel": "Xín Mần",
    "category": "nature",
    "elevation": 1200,
    "distanceFromStart": null,
    "difficulty": "Đòi hỏi tay lái vững",
    "bestTime": "Ngày quang, sáng hoặc cuối chiều; hỏi mùa gieo hoa, không mặc định luôn có tam giác mạch",
    "highlights": [
      "Tầm nhìn rộng trên đồi",
      "Nương và ruộng theo mùa",
      "Chụp ảnh hoa khi chủ vườn mở đón khách"
    ],
    "description": "Suôi Thầu có các triền đồi thoáng, nương canh tác và những khu trồng hoa theo mùa. Cảnh quan thay đổi theo lịch sản xuất của người dân; ảnh hoa hướng dương hay tam giác mạch phản ánh một thời điểm cụ thể.",
    "safetyTip": "Hỏi phí từng khu, không dẫm cây trồng. Mang nước và áo chắn gió; xác nhận chỗ ăn nghỉ thay vì dựa vào bài giới thiệu cũ.",
    "lat": null,
    "lng": null,
    "recommendedStayHours": 2.5,
    "localFood": [
      "Cơm địa phương ở Cốc Pài",
      "Món theo mùa"
    ],
    "imageSlug": "thao-nguyen-suoi-thau",
    "collection": "expanded-20260918",
    "sourceLinks": [
      {
        "title": "Nguồn: Chuyên trang du lịch nông thôn — Mênh mông Suôi Thầu",
        "url": "https://nongthon.vietnamtourism.gov.vn/menh-mong-suoi-thau-xin-man-ha-giang/"
      },
      {
        "title": "Cục Du lịch Quốc gia Việt Nam — Suoi Thau Plateau, bài năm 2024",
        "url": "https://vietnamtourism.vn/en/index.php/news/items/18350"
      }
    ],
    "sortOrder": 25
  },
];
