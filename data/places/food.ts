/**
 * DANH MỤC ẨM THỰC — món ăn, đặc sản mang về, và quán bán chúng.
 *
 * VÌ SAO MÓN ĂN LÀ THỰC THỂ CHỨ KHÔNG PHẢI THUỘC TÍNH CỦA ĐIỂM ĐẾN. Bản dữ liệu trước treo ẩm
 * thực dưới dạng mảng chuỗi trong từng điểm đến, và hệ quả là câu hỏi phổ biến nhất về ăn uống —
 * "thắng cố là gì, ăn ở đâu" — không có gì để tra ngoài việc quét văn bản mô tả. Ở đây mỗi món có
 * `slug` riêng, nên nó gắn được tài liệu tri thức riêng, lọc được theo `domain: "food"`, và trỏ
 * ngược về vùng qua `parentSlug` để câu hỏi "ăn gì ở Đồng Văn" gom được bằng cây thay vì bằng
 * đoán chữ.
 *
 * VÌ SAO MÓN ĂN KHÔNG CÓ `geo` VÀ KHÔNG CÓ `price`. Một món ăn không nằm ở đâu cả: thắng cố có ở
 * mọi phiên chợ trên cao nguyên đá, gán cho nó một toạ độ là mời công cụ thời tiết và công cụ
 * tính đường trả lời về một chỗ không tồn tại. Giá cũng vậy — cùng một bát thắng cố, ở phiên chợ
 * là một mức, trong nhà hàng phục vụ đoàn là mức khác hẳn; viết một con số vào thực thể món là
 * biến sự chênh lệch đó thành một lời khẳng định sai ở một trong hai nơi. Giá chỉ xuất hiện ở
 * `specialty` (món hàng đóng gói, có mặt bằng giá thật trên các sàn) và ở `restaurant` (một cơ sở
 * cụ thể, một mặt bằng giá cụ thể).
 *
 * VÌ SAO DANH SÁCH QUÁN NGẮN ĐẾN MỨC TRÔNG NHƯ CÒN THIẾU. Đây là lựa chọn, không phải phần làm
 * dở. Tên quán ăn ở Hà Giang là loại dữ kiện dễ bịa nhất và khó phát hiện nhất: một cái tên nghe
 * rất hợp lý, gắn với một địa chỉ nghe rất hợp lý, sẽ đi thẳng vào câu trả lời và khách chỉ biết
 * mình bị dẫn sai khi đã đứng trước một cửa hàng tạp hoá. Nên ở đây chỉ giữ những cơ sở thực sự
 * được nhắc đi nhắc lại trong các bài viết du lịch, và mọi mục đều mang `geo.precision:
 * "approximate"` cùng nhãn "can-xac-minh-places" — tức danh sách này là DANH SÁCH ỨNG VIÊN để
 * Google Places xác minh lúc chạy, chứ chưa phải danh bạ đã kiểm chứng. Thêm quán mới thì thêm
 * theo đúng chuẩn đó; hạ chuẩn để danh sách trông dài hơn là làm hỏng đúng thứ file này bảo vệ.
 *
 * VÌ SAO ĐỊA CHỈ CỦA QUÁN CỐ TÌNH GHI THÔ. Các nguồn không thống nhất về số nhà và tên đường của
 * mấy quán này, và một số nhà sai còn tệ hơn không có số nhà: khách gõ vào bản đồ rồi được dẫn
 * tới đúng một chỗ khác. Trường `address` ở đây chỉ ghi tới mức khu vực mà mọi nguồn đều đồng ý;
 * phần còn lại là việc của `googlePlaceId` sau khi adapter Places khớp được cơ sở thật.
 *
 * VỀ ĐƠN VỊ TÍNH CỦA ĐẶC SẢN. `PriceEstimate.unit` chỉ có năm mức, và không mức nào diễn tả được
 * "mỗi lít mật ong" hay "mỗi cân thịt trâu". Đó là hợp đồng kiểu đã chốt ở @data/places/types và
 * các tác tử khác đang viết song song dựa trên đúng bản đó, nên không được nới rộng ở đây. Cách
 * xử lý: dùng `per_dish` làm mức trung tính cho "một đơn vị hàng", rồi nói rõ đơn vị thật ở câu
 * đầu của `note`. Đọc giá đặc sản mà bỏ qua `note` là đọc sai một bậc độ lớn.
 */

import type { Place } from "./types";

export const FOOD_PLACES: Place[] = [
  // ---------------------------------------------------------------------------------------------
  // MÓN ĂN
  //
  // `parentSlug` ở nhóm này trả lời câu hỏi "hỏi về vùng nào thì món này nên nổi lên", chứ không
  // khẳng định món chỉ có ở đó. Món nào ăn được khắp địa bàn thì treo vào "ha-giang"; món nào mà
  // đi chệch khỏi một vùng là mất đúng cái làm nên nó (bánh cuốn chấm nước xương ở Đồng Văn, mèn
  // mén của người Mông trên cao nguyên đá) thì treo vào vùng đó.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "thang-co",
    name: "Thắng cố",
    nameEn: "Thang co",
    aliases: ["thang co", "thangco", "thang co ngua", "thang co bo", "chao thang co"],
    kind: "local_food",
    parentSlug: "ha-giang",
    // Treo vào "ha-giang" chứ không vào Mèo Vạc hay Đồng Văn dù hai phiên chợ đó nổi tiếng nhất:
    // thắng cố có ở mọi phiên chợ vùng cao nơi có người Mông, và gán nó cho một vùng sẽ khiến câu
    // hỏi "ở Quản Bạ ăn thắng cố được không" bị trả lời là không.
    tags: ["mon-nuoc", "cho-phien", "nguoi-mong", "mon-mua-lanh", "khau-vi-la"],
    sortOrder: 400,
  },
  {
    slug: "chao-au-tau",
    name: "Cháo ấu tẩu",
    nameEn: "Au tau porridge",
    aliases: ["chao au tau", "chaoautau", "chao au tau ha giang", "chao dang ha giang", "chao doc duoc"],
    kind: "local_food",
    parentSlug: "tp-ha-giang",
    // Đây là món hiếm hoi mà việc treo vào thành phố Hà Giang là chính xác chứ không phải tiện
    // tay: nghề nấu cháo ấu tẩu tập trung ở các quán đêm trong thành phố, còn trên cao nguyên đá
    // thì gần như không tìm được. Khách lên tới Đồng Văn mới nhớ ra muốn ăn là đã đi quá chỗ bán.
    tags: ["mon-nuoc", "an-dem", "mon-mua-lanh", "co-canh-bao-an-toan", "khau-vi-la"],
    sortOrder: 404,
  },
  {
    slug: "cu-au-tau",
    name: "Củ ấu tẩu",
    nameEn: "Aconite tuber",
    aliases: ["cu au tau", "au tau", "autau", "cu gau tau", "o dau", "phu tu"],
    kind: "local_food",
    // Củ ấu tẩu không phải một món ăn, và xếp nó vào `local_food` là một sự thoả hiệp có chủ ý.
    // Lý do: nó là nguyên liệu độc — có độc tố aconitin, phải ninh rất lâu mới ăn được — nên cảnh
    // báo về nó cần một khoá riêng để tài liệu an toàn gắn vào và để bộ phân giải bắt được khi
    // khách gõ đúng hai chữ "ấu tẩu". Nhét cảnh báo đó vào trong tài liệu của món cháo thì câu
    // hỏi "ấu tẩu là củ gì, mua về ngâm rượu được không" sẽ không khớp bộ lọc nào.
    parentSlug: "ha-giang",
    tags: ["nguyen-lieu", "co-canh-bao-an-toan", "khong-tu-che-bien", "cay-thuoc"],
    sortOrder: 408,
  },
  {
    slug: "banh-cuon-dong-van",
    name: "Bánh cuốn Đồng Văn",
    nameEn: "Dong Van steamed rice rolls",
    aliases: [
      "banh cuon dong van",
      "banh cuon cham nuoc xuong",
      "banh cuon trung dong van",
      "banh cuon ha giang",
      "banh cuon nong dong van",
    ],
    kind: "local_food",
    parentSlug: "dong-van",
    // Tách khỏi "bánh cuốn" nói chung vì điểm khác biệt nằm ở bát nước chấm: dưới xuôi chấm nước
    // mắm pha, ở đây chấm nước ninh xương nóng thả hành và giò. Một câu trả lời gộp hai thứ làm
    // một sẽ khiến khách gọi thêm nước mắm và bỏ lỡ đúng cái đáng đến đây để ăn.
    tags: ["an-sang", "mon-nuoc", "de-an", "pho-co-dong-van"],
    sortOrder: 412,
  },
  {
    slug: "men-men",
    name: "Mèn mén",
    nameEn: "Men men (steamed corn grits)",
    aliases: ["men men", "menmen", "com ngo", "ngo hap", "bot ngo hap"],
    kind: "local_food",
    parentSlug: "dong-van",
    // Treo vào Đồng Văn vì đây là lương thực chính của người Mông trên cao nguyên đá — nơi đất
    // hốc đá trồng được ngô mà không trồng được lúa. Đó cũng là lý do món này nên được giới thiệu
    // như một câu chuyện về đất chứ không như một món lạ miệng.
    tags: ["nguoi-mong", "cho-phien", "luong-thuc-chinh", "cao-nguyen-da"],
    sortOrder: 416,
  },
  {
    slug: "banh-tam-giac-mach",
    name: "Bánh tam giác mạch",
    nameEn: "Buckwheat cake",
    aliases: [
      "banh tam giac mach",
      "banhtamgiacmach",
      "banh hoa tam giac mach",
      "banh bot tam giac mach",
      "buckwheat cake",
    ],
    kind: "local_food",
    parentSlug: "dong-van",
    tags: ["an-vat", "mua-hoa-tam-giac-mach", "cho-phien", "de-an"],
    sortOrder: 420,
  },
  {
    slug: "thit-trau-gac-bep",
    name: "Thịt trâu gác bếp",
    nameEn: "Smoked buffalo meat",
    aliases: ["thit trau gac bep", "trau gac bep", "thit trau kho", "thit trau hun khoi", "thit bo gac bep"],
    kind: "local_food",
    parentSlug: "ha-giang",
    // Món này tồn tại hai lần trong danh mục và đó là chủ ý: ở đây là món ăn tại chỗ, còn
    // "thit-trau-gac-bep-dong-goi" là mặt hàng mang về có giá và có mặt bằng thị trường. Gộp lại
    // thành một thực thể thì hoặc là món ăn tự dưng có giá bán lẻ theo cân, hoặc là mặt hàng mua
    // về mất phần mô tả cách thưởng thức — cả hai đều trả lời sai một nửa số câu hỏi.
    tags: ["nguoi-thai", "nguoi-mong", "mon-nhau", "mang-ve-duoc", "quanh-nam"],
    sortOrder: 424,
  },
  {
    slug: "xoi-ngu-sac",
    name: "Xôi ngũ sắc",
    nameEn: "Five-colour sticky rice",
    aliases: ["xoi ngu sac", "xoingusac", "xoi nam mau", "xoi mau", "xoi bay mau"],
    kind: "local_food",
    parentSlug: "ha-giang",
    tags: ["nguoi-tay", "le-hoi", "de-an", "mon-chay-duoc"],
    sortOrder: 428,
  },
  {
    slug: "com-lam",
    name: "Cơm lam",
    nameEn: "Bamboo tube rice",
    aliases: ["com lam", "comlam", "com ong tre", "com nuong ong tre", "com lam bac me"],
    kind: "local_food",
    parentSlug: "ha-giang",
    // Không treo vào Bắc Mê dù "cơm lam Bắc Mê" là cách gọi quen: cơm lam bán dọc cả cung đường,
    // và neo món vào một vùng ở rìa hành trình sẽ đẩy nó ra khỏi mọi gợi ý cho khách đi vòng cung
    // chính. Mối liên hệ với vùng người Tày ở Bắc Mê được nói trong tài liệu tri thức, nơi có chỗ
    // để nói cho đủ ý mà không làm lệch bộ lọc theo cây.
    tags: ["nguoi-tay", "de-an", "mon-chay-duoc", "ban-doc-duong"],
    sortOrder: 432,
  },
  {
    slug: "lau-ga-den",
    name: "Lẩu gà đen",
    nameEn: "Black chicken hotpot",
    aliases: ["lau ga den", "ga den", "ga den hmong", "ga xuong den", "lau ga hmong"],
    kind: "local_food",
    parentSlug: "ha-giang",
    tags: ["mon-nuoc", "an-toi", "di-nhom", "mon-dat-tien"],
    sortOrder: 436,
  },
  {
    slug: "pho-chua",
    name: "Phở chua",
    nameEn: "Sour noodle salad",
    aliases: ["pho chua", "phochua", "pho chua ha giang", "pho tron chua", "pho chua vung cao"],
    kind: "local_food",
    parentSlug: "ha-giang",
    // Cần thận trọng khi trả lời về món này: phở chua là món chung của cả dải biên giới đông bắc,
    // và các phiên bản Cao Bằng, Lạng Sơn, Bắc Kạn đều có người nhận là gốc. Danh mục giữ nó lại
    // vì khách ăn được ở Hà Giang thật, chứ không phải để khẳng định xuất xứ.
    tags: ["mon-tron", "an-trua", "mon-mat", "co-o-tinh-khac"],
    sortOrder: 440,
  },
  {
    slug: "ca-bong",
    name: "Cá bỗng",
    nameEn: "Ca bong fish",
    aliases: ["ca bong", "cabong", "ca bong nuong", "ca bong song lo", "ca bong song nho que", "goi ca bong"],
    kind: "local_food",
    parentSlug: "ha-giang",
    // Khách hay hỏi bằng cụm "cá bỗng sông Nho Quế" nên alias phải bắt được, nhưng tên thực thể
    // thì cố tình không neo vào con sông đó. Cá bỗng là cá nuôi ao và nuôi lồng lâu đời của người
    // Tày ở vùng thấp — quanh sông Lô, sông Gâm, sông Miện — còn thứ khách ăn ở bến thuyền Nho
    // Quế là cá nướng bán cho khách đi thuyền, không phải một giống cá riêng của con sông ấy. Đặt
    // tên theo cách quen của khách ở đây sẽ là ghi một điều không đúng vào khoá dữ liệu.
    tags: ["nguoi-tay", "ca-nuoc-ngot", "mon-nhau", "vung-thap"],
    sortOrder: 444,
  },
  {
    slug: "rau-cai-meo",
    name: "Rau cải mèo",
    nameEn: "Cai meo mustard greens",
    aliases: ["rau cai meo", "caimeo", "cai meo", "cai hmong", "rau cai dang vung cao"],
    kind: "local_food",
    parentSlug: "ha-giang",
    tags: ["rau", "mon-chay-duoc", "mon-mua-lanh", "de-an", "gia-re"],
    sortOrder: 448,
  },
  {
    slug: "thit-lon-cap-nach",
    name: "Thịt lợn cắp nách",
    nameEn: "Cap nach pork",
    aliases: ["thit lon cap nach", "lon cap nach", "lon ban", "heo cap nach", "lon den vung cao"],
    kind: "local_food",
    parentSlug: "ha-giang",
    tags: ["mon-nuong", "di-nhom", "cho-phien", "mon-nhau"],
    sortOrder: 452,
  },
  {
    slug: "banh-chung-gu",
    name: "Bánh chưng gù",
    nameEn: "Banh chung gu",
    aliases: ["banh chung gu", "banhchunggu", "banh chung gu ha giang", "banh chung gu ban tuy", "banh chung dai"],
    kind: "local_food",
    parentSlug: "tp-ha-giang",
    // Treo vào thành phố vì nghề gói tập trung ở làng nghề bên rìa thành phố Hà Giang, và đây là
    // thứ khách mua ngay khi vừa tới hoặc lúc chuẩn bị về — tức nó thuộc về điểm đầu và điểm cuối
    // hành trình, không thuộc về cao nguyên đá.
    tags: ["nguoi-tay", "nguoi-dao", "lang-nghe", "mang-ve-duoc", "tet"],
    sortOrder: 456,
  },

  // ---------------------------------------------------------------------------------------------
  // ĐẶC SẢN MANG VỀ
  //
  // Khác biệt duy nhất so với nhóm trên, nhưng là khác biệt quyết định: những thứ này có mặt bằng
  // giá bán lẻ thật, khảo được trên các sàn thương mại điện tử, nên chúng có `price`. Nguồn tham
  // chiếu ở đây là Shopee và Tiki chứ không phải các trang du lịch, và đó là lựa chọn đúng chỗ:
  // đây là hàng hoá bán lẻ, người bán thật đang niêm yết thật, còn trang tour thì chỉ nhắc tên
  // đặc sản chứ không bán chúng. Mọi mức giá dưới đây là TRUNG VỊ CÁC TIN ĐĂNG, tức
  // `market_estimate`, và tuyệt đối không được trích như giá niêm yết.
  //
  // Cạm bẫy phải nói trước với khách: mật ong bạc hà và chè Shan tuyết cổ thụ là hai mặt hàng bị
  // làm giả nhiều nhất trong nhóm này. Khoảng giá rộng ở dưới phản ánh đúng thực tế đó — cận dưới
  // thường không phải hàng thật, nên một câu trả lời chỉ nêu cận dưới là câu trả lời gây hại.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "mat-ong-bac-ha",
    name: "Mật ong bạc hà",
    nameEn: "Mint honey",
    aliases: ["mat ong bac ha", "matongbacha", "mat ong hoa bac ha", "mat ong meo vac", "mat ong cao nguyen da"],
    kind: "specialty",
    parentSlug: "meo-vac",
    price: {
      minVnd: 500_000,
      maxVnd: 1_000_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=mat%20ong%20bac%20ha%20ha%20giang",
        "https://tiki.vn/search?q=mat%20ong%20bac%20ha",
      ],
      note:
        "Đơn vị thật là MỘT LÍT, không phải một suất — `PriceEstimate.unit` không có mức 'mỗi lít' nên " +
        "dùng tạm `per_dish`. Khoảng giá là trung vị các tin đăng có ghi rõ vùng Mèo Vạc; các tin dưới " +
        "cận dưới này thường là mật hoa khác pha hoặc mật nuôi công nghiệp gắn nhãn bạc hà.",
    },
    // Đây là mặt hàng duy nhất trong nhóm có chỉ dẫn địa lý gắn với địa bàn Mèo Vạc, nên treo vào
    // đúng vùng đó chứ không treo chung vào "ha-giang": đặc điểm khiến nó đắt là cây bạc hà dại
    // chỉ nở trên cao nguyên đá, và làm mờ chi tiết ấy là mở đường cho hàng trà trộn.
    tags: ["chi-dan-dia-ly", "mang-ve-duoc", "de-bi-lam-gia", "mua-cuoi-nam"],
    sortOrder: 600,
  },
  {
    slug: "che-shan-tuyet",
    name: "Chè Shan tuyết",
    nameEn: "Shan tuyet tea",
    aliases: ["che shan tuyet", "cheshantuyet", "tra shan tuyet", "che co thu", "che shan tuyet ha giang", "shan tuyet"],
    kind: "specialty",
    parentSlug: "hoang-su-phi",
    price: {
      minVnd: 250_000,
      maxVnd: 900_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=che%20shan%20tuyet%20ha%20giang",
        "https://tiki.vn/search?q=tra%20shan%20tuyet%20co%20thu",
      ],
      note:
        "Đơn vị thật là MỘT CÂN chè khô. Khoảng giá này chỉ áp cho chè khô phổ thông; trà cổ thụ hái " +
        "tay theo lô nhỏ và các dòng bạch trà, hồng trà từ cây cổ thụ vượt xa cận trên và cần khảo " +
        "riêng theo từng lô, không suy được từ mặt bằng chung.",
    },
    // Treo vào Hoàng Su Phì vì vùng chè cổ thụ có tiếng nhất nằm ở nhánh phía tây. Nhưng Lũng Phìn
    // bên Đồng Văn cũng là một vùng chè Shan có tên tuổi, và alias phải đủ rộng để câu hỏi từ phía
    // cao nguyên đá vẫn khớp — chi tiết đó thuộc về tài liệu tri thức, không thuộc về `parentSlug`.
    tags: ["mang-ve-duoc", "de-bi-lam-gia", "nhanh-phia-tay", "quanh-nam"],
    sortOrder: 604,
  },
  {
    slug: "ruou-ngo-thanh-van",
    name: "Rượu ngô Thanh Vân",
    nameEn: "Thanh Van corn wine",
    aliases: ["ruou ngo thanh van", "ruou ngo quan ba", "ruou thanh van", "ruou ngo ha giang", "ruou men la"],
    kind: "specialty",
    parentSlug: "quan-ba",
    price: {
      minVnd: 60_000,
      maxVnd: 150_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=ruou%20ngo%20thanh%20van%20quan%20ba",
        "https://shopee.vn/search?keyword=ruou%20ngo%20men%20la%20ha%20giang",
      ],
      note:
        "Đơn vị thật là MỘT LÍT rượu bán rời hoặc đóng can. Rượu đóng chai có nhãn và tem của cơ sở " +
        "sản xuất nằm cao hơn khoảng này; ngược lại rượu bán tại phiên chợ theo can thường thấp hơn " +
        "cận dưới và không có gì bảo đảm về nồng độ hay men.",
    },
    tags: ["do-uong-co-con", "mang-ve-duoc", "lang-nghe", "quanh-nam"],
    sortOrder: 608,
  },
  {
    slug: "banh-tam-giac-mach-kho",
    name: "Bánh tam giác mạch khô đóng gói",
    nameEn: "Packaged dried buckwheat cake",
    aliases: [
      "banh tam giac mach kho",
      "banh tam giac mach dong goi",
      "banh tam giac mach mua ve",
      "bot tam giac mach",
    ],
    kind: "specialty",
    parentSlug: "dong-van",
    price: {
      minVnd: 60_000,
      maxVnd: 150_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=banh%20tam%20giac%20mach%20ha%20giang",
        "https://tiki.vn/search?q=banh%20tam%20giac%20mach",
      ],
      note:
        "Đơn vị thật là MỘT TÚI nhiều chiếc, cỡ túi khác nhau nhiều giữa các người bán nên khoảng giá " +
        "rộng. Bánh nướng nóng bán lẻ từng chiếc ngay tại chợ phiên rẻ hơn hẳn và không thuộc mức giá " +
        "này — đó là món ăn tại chỗ, tra ở `banh-tam-giac-mach`.",
    },
    tags: ["mang-ve-duoc", "mua-hoa-tam-giac-mach", "qua-tang", "de-van-chuyen"],
    sortOrder: 612,
  },
  {
    slug: "thit-trau-gac-bep-dong-goi",
    name: "Thịt trâu gác bếp đóng gói",
    nameEn: "Packaged smoked buffalo meat",
    aliases: [
      "thit trau gac bep dong goi",
      "trau gac bep hut chan khong",
      "thit trau gac bep mua ve",
      "trau gac bep dac san",
    ],
    kind: "specialty",
    parentSlug: "ha-giang",
    price: {
      minVnd: 700_000,
      maxVnd: 1_300_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=thit%20trau%20gac%20bep%20ha%20giang",
        "https://tiki.vn/search?q=thit%20trau%20gac%20bep",
      ],
      note:
        "Đơn vị thật là MỘT CÂN thành phẩm. Đây là mặt hàng mà chênh lệch giá nói lên nguyên liệu: " +
        "thịt trâu thật hao rất nhiều khi sấy nên khó xuống dưới cận dưới, còn các tin đăng rẻ hơn " +
        "thường là thịt bò hoặc thịt lợn tẩm gia vị trâu gác bếp.",
    },
    tags: ["mang-ve-duoc", "de-bi-lam-gia", "hut-chan-khong", "qua-tang", "quanh-nam"],
    sortOrder: 616,
  },
  {
    slug: "hong-khong-hat-quan-ba",
    name: "Hồng không hạt Quản Bạ",
    nameEn: "Quan Ba seedless persimmon",
    aliases: ["hong khong hat quan ba", "hong khong hat ha giang", "hong quan ba", "hong gion quan ba"],
    kind: "specialty",
    parentSlug: "quan-ba",
    price: {
      minVnd: 50_000,
      maxVnd: 100_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=hong%20khong%20hat%20quan%20ba",
        "https://tiki.vn/search?q=hong%20khong%20hat%20ha%20giang",
      ],
      note:
        "Đơn vị thật là MỘT CÂN quả tươi. Đây là mặt hàng theo vụ nên khoảng giá chỉ có nghĩa trong " +
        "mùa thu hoạch; ngoài vụ thì các tin đăng còn lại phần lớn là hồng vùng khác gắn nhãn Quản Bạ.",
    },
    tags: ["chi-dan-dia-ly", "trai-cay", "theo-vu", "kho-van-chuyen"],
    sortOrder: 620,
  },
  {
    slug: "cam-sanh-ha-giang",
    name: "Cam sành Hà Giang",
    nameEn: "Ha Giang king orange",
    aliases: ["cam sanh ha giang", "cam sanh bac quang", "cam ha giang", "camsanh"],
    kind: "specialty",
    parentSlug: "ha-giang",
    price: {
      minVnd: 15_000,
      maxVnd: 40_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://shopee.vn/search?keyword=cam%20sanh%20ha%20giang",
        "https://tiki.vn/search?q=cam%20sanh%20ha%20giang",
      ],
      note:
        "Đơn vị thật là MỘT CÂN quả tươi, mua tại vườn hoặc ven quốc lộ vùng trồng. Giá bán lẻ về tới " +
        "thành phố lớn cao hơn nhiều lần vì cộng cước vận chuyển, nên đừng dùng khoảng này để trả lời " +
        "câu hỏi mua cam Hà Giang ở Hà Nội hết bao nhiêu.",
    },
    // Vùng trồng thật nằm ở phía nam địa bàn, quanh Bắc Quang và Quang Bình — hai nơi chưa có
    // trong cây địa lý vì khách đi du lịch không dừng ở đó. Treo vào "ha-giang" là cách giữ đúng
    // nguyên tắc không bịa slug địa lý mới, và tài liệu tri thức nói rõ vùng trồng bằng lời.
    tags: ["chi-dan-dia-ly", "trai-cay", "theo-vu", "mua-cuoi-nam", "vung-thap"],
    sortOrder: 624,
  },

  // ---------------------------------------------------------------------------------------------
  // QUÁN ĂN
  //
  // Đọc kỹ đoạn "VÌ SAO DANH SÁCH QUÁN NGẮN" ở đầu file trước khi thêm mục vào đây. Ba mục dưới
  // đây là những cơ sở được nhắc lại đủ nhiều trong các bài viết du lịch để đáng đưa vào danh
  // sách ứng viên, không phải ba quán ngon nhất Hà Giang — dự án không có cơ sở nào để xếp hạng
  // như vậy, và giả vờ có là loại sai tệ nhất trong nhóm dữ liệu này.
  //
  // Cả ba đều là hộ kinh doanh nhỏ, tức là loại cơ sở đóng cửa hoặc đổi chủ mà không ai cập nhật
  // ở đâu cả. `can-xac-minh-places` không phải nhãn thủ tục: nếu adapter Places không khớp được
  // cơ sở lúc chạy thì tác tử phải nói là chưa xác minh được, chứ không được đọc thẳng mục này ra
  // như một gợi ý chắc chắn.
  // ---------------------------------------------------------------------------------------------
  {
    slug: "chao-au-tau-ba-hoa",
    name: "Quán cháo ấu tẩu Bà Hoa",
    aliases: ["chao au tau ba hoa", "quan ba hoa", "chao au tau ba hoa ha giang", "quan chao au tau ba hoa"],
    kind: "restaurant",
    parentSlug: "tp-ha-giang",
    geo: { lat: 22.8256, lng: 104.9807, elevationM: 105, precision: "approximate" },
    // Toạ độ là điểm giữa khu trung tâm thành phố, không phải vị trí cửa quán. Các nguồn ghi số
    // nhà khác nhau nên `address` dừng ở mức khu vực: một số nhà sai còn tệ hơn không có số nhà,
    // vì khách sẽ gõ nó vào bản đồ rồi được dẫn tới đúng một chỗ khác trong đêm.
    address: "Khu vực trung tâm thành phố Hà Giang, tỉnh Tuyên Quang",
    openingHours: {
      // Giờ này là giờ được nhắc lại trong các bài viết, không phải giờ niêm yết. Điểm cần nói với
      // khách là quán mở buổi tối chứ không bán ban ngày — nhầm chỗ đó là mất luôn cơ hội ăn, vì
      // hôm sau đoàn đã lên đường.
      text: "Bán buổi tối, thường từ chập tối tới khuya; không bán ban ngày.",
      cadence: "daily",
    },
    price: {
      minVnd: 25_000,
      maxVnd: 50_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.foody.vn/ha-giang",
        "https://www.klook.com/vi/search/?query=Ha%20Giang",
      ],
      note:
        "Một bát cháo. Suy từ mặt bằng các quán cháo cùng loại trong thành phố trên Foody và từ phần " +
        "chi phí ăn uống mà các tour Hà Giang trên Klook công bố, không phải giá đọc được từ bảng giá " +
        "của quán.",
    },
    tags: ["can-xac-minh-places", "an-dem", "mon-dia-phuong", "quan-nho", "co-canh-bao-an-toan"],
    sortOrder: 700,
  },
  {
    slug: "banh-cuon-ba-lan",
    name: "Quán bánh cuốn Bà Làn",
    aliases: ["banh cuon ba lan", "quan ba lan dong van", "banh cuon ba lan dong van", "banh cuon pho co dong van"],
    kind: "restaurant",
    parentSlug: "dong-van",
    geo: { lat: 23.2779, lng: 105.3618, elevationM: 1025, precision: "approximate" },
    // Toạ độ lấy theo khu phố cổ Đồng Văn chứ không theo cửa quán. Lưu ý thêm cho người xác minh:
    // các nguồn chép tên chủ quán không thống nhất — có nơi ghi Bà Làn, có nơi ghi Bà Lan hoặc
    // Bà Hà — nên khi khớp Places phải khớp theo vị trí và mặt hàng, đừng khớp cứng theo tên.
    address: "Khu phố cổ Đồng Văn, tỉnh Tuyên Quang",
    openingHours: {
      text: "Bán buổi sáng sớm, hết hàng thì nghỉ; đông nhất vào sáng phiên chợ Chủ nhật.",
      cadence: "daily",
    },
    price: {
      minVnd: 25_000,
      maxVnd: 50_000,
      unit: "per_dish",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.foody.vn/ha-giang",
        "https://www.klook.com/vi/search/?query=Ha%20Giang",
      ],
      note:
        "Một suất bánh cuốn kèm bát nước xương. Gọi thêm trứng hoặc giò thì lên trên cận trên; đây là " +
        "trung vị mặt bằng bánh cuốn trong khu phố cổ chứ không phải bảng giá của riêng quán.",
    },
    tags: ["can-xac-minh-places", "an-sang", "mon-dia-phuong", "quan-nho", "pho-co-dong-van"],
    sortOrder: 704,
  },
  {
    slug: "nha-hang-hoa-cuong-dong-van",
    name: "Nhà hàng Hoa Cương Đồng Văn",
    // Không khai "hoa cuong dong van" và "khach san hoa cuong dong van" ở đây: cả hai là cách gọi
    // chung của cơ sở, mà cơ sở được biết tới trước hết như một khách sạn (xem ghi chú bên dưới),
    // nên chúng thuộc về ks-hoa-cuong-dong-van. Khai cả hai nơi thì bộ phân giải chọn theo thứ tự
    // file, tức kết quả đổi khi ai đó sắp xếp lại danh mục.
    aliases: ["nha hang hoa cuong", "nha hang hoa cuong dong van"],
    kind: "restaurant",
    parentSlug: "dong-van",
    geo: { lat: 23.2765, lng: 105.3648, elevationM: 1025, precision: "approximate" },
    // Cơ sở này được biết đến trước hết như một khách sạn; phần nhà hàng là nơi các đoàn đặt cơm
    // tối. Ghi rõ điều đó ở đây vì nó đổi cách trả lời: khách lẻ ghé ăn thì nên gọi trước, còn
    // khách hỏi chỗ ngủ thì phải được dẫn sang danh mục lưu trú chứ không phải mục này.
    address: "Thị trấn Đồng Văn, tỉnh Tuyên Quang",
    openingHours: {
      text: "Phục vụ theo bữa trưa và bữa tối; đoàn đông nên đặt trước trong mùa cao điểm.",
      cadence: "daily",
    },
    price: {
      minVnd: 150_000,
      maxVnd: 350_000,
      unit: "per_person",
      basis: "market_estimate",
      surveyedAt: "2026-09-09",
      sourceUrls: [
        "https://www.klook.com/vi/search/?query=Ha%20Giang",
        "https://www.booking.com/searchresults.vi.html?ss=Dong%20Van",
      ],
      note:
        "Một suất ăn theo mâm đoàn, tính trên đầu người. Suy từ phần chi phí bữa tối trong các tour " +
        "Hà Giang trên Klook và từ mức ăn kèm phòng của các cơ sở cùng hạng ở Đồng Văn trên Booking; " +
        "gọi lẩu gà đen thì vượt cận trên vì con gà tính riêng.",
    },
    tags: ["can-xac-minh-places", "di-nhom", "an-toi", "dat-truoc", "vong-cung-chinh"],
    sortOrder: 708,
  },
];
