import type { ImageRef } from "@data/website/types";

/**
 * ẢNH LẤY TỪ WIKIMEDIA COMMONS — file này được SINH TỰ ĐỘNG, đừng sửa tay.
 *
 *   npx tsx scripts/fetch-place-images.ts
 *
 * Mọi ảnh ở đây đã qua bộ lọc giấy phép của script: chỉ nhận CC0, CC BY, CC BY-SA và phạm vi
 * công cộng, tức các giấy phép cho phép dùng lại. Ảnh dùng giấy phép phi thương mại hoặc cấm
 * phái sinh bị loại ngay từ lúc thu thập.
 *
 * `credit` và `license` KHÔNG phải trường trang trí: CC BY và CC BY-SA đòi ghi tên tác giả, nên
 * giao diện phải hiển thị chúng cạnh ảnh. Bỏ phần ghi công là vi phạm giấy phép.
 *
 * URL trỏ thẳng vào upload.wikimedia.org. Đây là đánh đổi có ý thức: không phải tự lưu ảnh nên
 * repo gọn, nhưng hiển thị ảnh thì phụ thuộc vào hạ tầng của Wikimedia. Nếu sau này cần chắc
 * chắn hơn thì tải ảnh về và phục vụ tại chỗ — cấu trúc ImageRef không phải đổi.
 */
export const PLACE_IMAGES: Record<string, ImageRef[]> = {
  "deo-ma-pi-leng": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/M%C3%A3_P%C3%AD_L%C3%A8ng_Pass%2C_Vietnam.jpg/1280px-M%C3%A3_P%C3%AD_L%C3%A8ng_Pass%2C_Vietnam.jpg",
      credit: "Hoach Le Dinh",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:M%C3%A3_P%C3%AD_L%C3%A8ng_Pass%2C_Vietnam.jpg",
      widthPx: 6000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Ma_Pi_Leng_Pass_winding_road_Ha_Giang_Vietnam.jpg/1280px-Ma_Pi_Leng_Pass_winding_road_Ha_Giang_Vietnam.jpg",
      credit: "Khánh Hmoong",
      license: "CC BY 2.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ma_Pi_Leng_Pass_winding_road_Ha_Giang_Vietnam.jpg",
      widthPx: 3896,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Ma_Pi_Leng_pass_plateau_in_2014.jpg/1280px-Ma_Pi_Leng_pass_plateau_in_2014.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ma_Pi_Leng_pass_plateau_in_2014.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Ma_Pi_Leng_pass_information_board.jpg/1280px-Ma_Pi_Leng_pass_information_board.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ma_Pi_Leng_pass_information_board.jpg",
      widthPx: 3552,
    },
  ],
  "hem-tu-san": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/TuSan_Canyon.jpg/1280px-TuSan_Canyon.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:TuSan_Canyon.jpg",
      widthPx: 6000,
    },
  ],
  "song-nho-que": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/S%C3%B4ng_Nho_Qu%E1%BA%BF_2022_-_NKS.jpg/1280px-S%C3%B4ng_Nho_Qu%E1%BA%BF_2022_-_NKS.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%C3%B4ng_Nho_Qu%E1%BA%BF_2022_-_NKS.jpg",
      widthPx: 6000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Th%E1%BB%A7y_%C4%91i%E1%BB%87n_Nho_Qu%E1%BA%BF_1_-_NKS.jpg/1280px-Th%E1%BB%A7y_%C4%91i%E1%BB%87n_Nho_Qu%E1%BA%BF_1_-_NKS.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Th%E1%BB%A7y_%C4%91i%E1%BB%87n_Nho_Qu%E1%BA%BF_1_-_NKS.jpg",
      widthPx: 6000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/S%C3%B4ng_Nho_Qu%E1%BA%BF.jpg/1280px-S%C3%B4ng_Nho_Qu%E1%BA%BF.jpg",
      credit: "Khoitran1957",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%C3%B4ng_Nho_Qu%E1%BA%BF.jpg",
      widthPx: 2844,
    },
  ],
  "cot-co-lung-cu": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg",
      widthPx: 3552,
    },
  ],
  "pho-co-dong-van": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Dong_Van_old_town.jpg/1280px-Dong_Van_old_town.jpg",
      credit: "HuangWending18072009",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Dong_Van_old_town.jpg",
      widthPx: 4096,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/A_view_over_the_old_city_Amsterdam_to_the_left%2C_and_sandy_construction_sites_right%3B_free_photo_Amsterdam_2005%2C_Fons_Heijnsbroek.jpg/1280px-A_view_over_the_old_city_Amsterdam_to_the_left%2C_and_sandy_construction_sites_right%3B_free_photo_Amsterdam_2005%2C_Fons_Heijnsbroek.jpg",
      credit: "Fons Heijnsbroek",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:A_view_over_the_old_city_Amsterdam_to_the_left%2C_and_sandy_construction_sites_right%3B_free_photo_Amsterdam_2005%2C_Fons_Heijnsbroek.jpg",
      widthPx: 2048,
    },
  ],
  "cao-nguyen-da-dong-van": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Cao_nguy%C3%AAn_%C4%91%C3%A1_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg/1280px-Cao_nguy%C3%AAn_%C4%91%C3%A1_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Cao_nguy%C3%AAn_%C4%91%C3%A1_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg",
      widthPx: 6000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/B%C3%A3i_%C4%91%C3%A1_m%E1%BA%B7t_tr%C4%83ng_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg/1280px-B%C3%A3i_%C4%91%C3%A1_m%E1%BA%B7t_tr%C4%83ng_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:B%C3%A3i_%C4%91%C3%A1_m%E1%BA%B7t_tr%C4%83ng_%C4%90%E1%BB%93ng_V%C4%83n_-_NKS.jpg",
      widthPx: 6000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Tham_Ma_pass_-_Dong_Van.jpg/1280px-Tham_Ma_pass_-_Dong_Van.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Tham_Ma_pass_-_Dong_Van.jpg",
      widthPx: 2048,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Karst%40SinhLung_DongVan_HaGiang.jpg/1280px-Karst%40SinhLung_DongVan_HaGiang.jpg",
      credit: "BacLuong at Vietnamese Wikipedia",
      license: "Public domain",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Karst%40SinhLung_DongVan_HaGiang.jpg",
      widthPx: 1996,
    },
  ],
  "deo-bac-sum": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/D%E1%BB%91c_B%E1%BA%AFc_Sum_%2846762031595%29.jpg/1280px-D%E1%BB%91c_B%E1%BA%AFc_Sum_(46762031595).jpg",
      credit: "Sketyl none",
      license: "CC BY 2.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:D%E1%BB%91c_B%E1%BA%AFc_Sum_(46762031595).jpg",
      widthPx: 6022,
    },
  ],
  "tp-ha-giang": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Ha_Giang_City_Square.jpg/1280px-Ha_Giang_City_Square.jpg",
      credit: "HuangWending18072009",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ha_Giang_City_Square.jpg",
      widthPx: 4096,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/H%C3%A0_Giang_City.jpg/1280px-H%C3%A0_Giang_City.jpg",
      credit: "Idan Robbins",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:H%C3%A0_Giang_City.jpg",
      widthPx: 3864,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_02.jpg/1280px-Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_02.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_02.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_04.jpg/1280px-Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_04.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Hmong_specialities_restaurant_in_Ha_Giang_city_in_2014_04.jpg",
      widthPx: 3552,
    },
  ],
  "dong-van": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%281%29.jpg/1280px-Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      widthPx: 6864,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg/1280px-Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      widthPx: 6316,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%289%29.jpg/1280px-Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(9).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(9).jpg",
      widthPx: 4646,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%282%29.jpg/1280px-Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(2).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Tt._%C4%90%E1%BB%93ng_V%C4%83n%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(2).jpg",
      widthPx: 4192,
    },
  ],
  "meo-vac": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Meo_Vac_Commune_Square%2C_Tuyen_Quang_Province.jpg/1280px-Meo_Vac_Commune_Square%2C_Tuyen_Quang_Province.jpg",
      credit: "HuangWending18072009",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Meo_Vac_Commune_Square%2C_Tuyen_Quang_Province.jpg",
      widthPx: 4096,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Central_Area_of_Meo_Vac_Commune%2C_Tuyen_Quang_Province.jpg/1280px-Central_Area_of_Meo_Vac_Commune%2C_Tuyen_Quang_Province.jpg",
      credit: "HuangWending18072009",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Central_Area_of_Meo_Vac_Commune%2C_Tuyen_Quang_Province.jpg",
      widthPx: 4096,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/L%C5%A9ng_P%C3%B9%2C_M%C3%A8o_V%E1%BA%A1c%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg/1280px-L%C5%A9ng_P%C3%B9%2C_M%C3%A8o_V%E1%BA%A1c%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      credit: "kimjongdae",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:L%C5%A9ng_P%C3%B9%2C_M%C3%A8o_V%E1%BA%A1c%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      widthPx: 4032,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Le_col_de_Ma_Pi_Leng_%28Dong_Van-Meo_Vac%29.jpg/1280px-Le_col_de_Ma_Pi_Leng_(Dong_Van-Meo_Vac).jpg",
      credit: "Jaybeelarsay",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Le_col_de_Ma_Pi_Leng_(Dong_Van-Meo_Vac).jpg",
      widthPx: 2592,
    },
  ],
  "yen-minh": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Street_in_Yen_Minh_city_in_2014.jpg/1280px-Street_in_Yen_Minh_city_in_2014.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Street_in_Yen_Minh_city_in_2014.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Needle_trees_in_the_Yen_Minh_district_1.jpg/1280px-Needle_trees_in_the_Yen_Minh_district_1.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Needle_trees_in_the_Yen_Minh_district_1.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Shops_in_Yen_Minh_city_in_2014.jpg/1280px-Shops_in_Yen_Minh_city_in_2014.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Shops_in_Yen_Minh_city_in_2014.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Road_in_Yen_Minh_district_in_2014.jpg/1280px-Road_in_Yen_Minh_district_in_2014.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Road_in_Yen_Minh_district_in_2014.jpg",
      widthPx: 3552,
    },
  ],
  "quan-ba": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_1.jpg/1280px-Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_1.jpg",
      credit: "Benjamin Smith",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_1.jpg",
      widthPx: 5496,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_2.jpg/1280px-Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_2.jpg",
      credit: "Benjamin Smith",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Qu%E1%BA%A3n_B%E1%BA%A1%2C_Vietnam_-_2.jpg",
      widthPx: 5496,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg/1280px-C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      widthPx: 3264,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%281%29.jpg/1280px-C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:C%C3%A1n_T%E1%BB%B7%2C_Qu%E1%BA%A3n_B%E1%BA%A1%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      widthPx: 3264,
    },
  ],
  "sung-la": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg/1280px-S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio.jpg",
      widthPx: 4192,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%282%29.jpg/1280px-S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(2).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(2).jpg",
      widthPx: 4192,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%281%29.jpg/1280px-S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(1).jpg",
      widthPx: 3264,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_%283%29.jpg/1280px-S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(3).jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:S%E1%BB%A7ng_L%C3%A0%2C_%C4%90%E1%BB%93ng_V%C4%83n%2C_H%C3%A0_Giang%2C_Vietnam_-_panoramio_(3).jpg",
      widthPx: 3264,
    },
  ],
  "lung-cu": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_03.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_04.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_05.jpg",
      widthPx: 3552,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg/1280px-Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Lung_Cu_flag_tower_of_Ha_Giang_in_2014_06.jpg",
      widthPx: 3552,
    },
  ],
  "du-gia": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Du_Gi%C3%A0.jpg/1280px-Du_Gi%C3%A0.jpg",
      credit: "NKSTTSSHNVN",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Du_Gi%C3%A0.jpg",
      widthPx: 2048,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Porte_d%27entr%C3%A9e_au_Yamen_du_Tu%E1%BA%A7n-Ph%E1%BB%A7_Blockhaus_crenel%C3%A9_%C3%A0_%C3%A9tage_et_logements_des_l%C3%ADnh-c%C6%A1_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg/1280px-Porte_d'entr%C3%A9e_au_Yamen_du_Tu%E1%BA%A7n-Ph%E1%BB%A7_Blockhaus_crenel%C3%A9_%C3%A0_%C3%A9tage_et_logements_des_l%C3%ADnh-c%C6%A1_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg",
      credit: "The government of the French protectorate of Tonkin, French Indo-China.",
      license: "Public domain",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Porte_d'entr%C3%A9e_au_Yamen_du_Tu%E1%BA%A7n-Ph%E1%BB%A7_Blockhaus_crenel%C3%A9_%C3%A0_%C3%A9tage_et_logements_des_l%C3%ADnh-c%C6%A1_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg",
      widthPx: 833,
    },
  ],
  "khau-vai": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Kh%E1%BA%A9u_Trang_v%E1%BA%A3i.JPG/1280px-Kh%E1%BA%A9u_Trang_v%E1%BA%A3i.JPG",
      credit: "Eternal Dragon",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Kh%E1%BA%A9u_Trang_v%E1%BA%A3i.JPG",
      widthPx: 4608,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg/1280px-Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg",
      credit: "Hoangvantoanajc",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg",
      widthPx: 2288,
    },
  ],
  "hoang-su-phi": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Ru%E1%BB%99ng_b%E1%BA%ADc_thang_%E1%BB%9F_Ho%C3%A0ng_Su_Ph%C3%AC.jpg/1280px-Ru%E1%BB%99ng_b%E1%BA%ADc_thang_%E1%BB%9F_Ho%C3%A0ng_Su_Ph%C3%AC.jpg",
      credit: "Quangpraha",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ru%E1%BB%99ng_b%E1%BA%ADc_thang_%E1%BB%9F_Ho%C3%A0ng_Su_Ph%C3%AC.jpg",
      widthPx: 3800,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Seal_of_Ho%C3%A0ng_Su_Ph%C3%AC_District.png/1280px-Seal_of_Ho%C3%A0ng_Su_Ph%C3%AC_District.png",
      credit: "Manh2107",
      license: "CC0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Seal_of_Ho%C3%A0ng_Su_Ph%C3%AC_District.png",
      widthPx: 3471,
    },
  ],
  "pho-bang": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/L%C3%B4_c%E1%BB%91t_%E1%BB%9F_c%E1%BB%ADa_ng%C3%B5_th%C3%A0nh_ph%E1%BB%91%2C_ph%C3%ADa_H%C3%A0_Giang_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg/1280px-L%C3%B4_c%E1%BB%91t_%E1%BB%9F_c%E1%BB%ADa_ng%C3%B5_th%C3%A0nh_ph%E1%BB%91%2C_ph%C3%ADa_H%C3%A0_Giang_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg",
      credit: "The government of the French protectorate of Tonkin, French Indo-China.",
      license: "Public domain",
      sourcePage: "https://commons.wikimedia.org/wiki/File:L%C3%B4_c%E1%BB%91t_%E1%BB%9F_c%E1%BB%ADa_ng%C3%B5_th%C3%A0nh_ph%E1%BB%91%2C_ph%C3%ADa_H%C3%A0_Giang_-_Trung_t%C3%A2m_L%C6%B0u_tr%E1%BB%AF_qu%E1%BB%91c_gia_I.jpg",
      widthPx: 834,
    },
  ],
  "cho-phien-dong-van": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Dong_Van_market%2Ctt_Dong_Van_%2C_Hagiang%2C_Vi%E1%BB%87t_Nam_-_panoramio.jpg/1280px-Dong_Van_market%2Ctt_Dong_Van_%2C_Hagiang%2C_Vi%E1%BB%87t_Nam_-_panoramio.jpg",
      credit: "trungydang",
      license: "CC BY 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Dong_Van_market%2Ctt_Dong_Van_%2C_Hagiang%2C_Vi%E1%BB%87t_Nam_-_panoramio.jpg",
      widthPx: 7602,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/A_corner_in_Dong_Van_Market.jpg/1280px-A_corner_in_Dong_Van_Market.jpg",
      credit: "Zennysmile",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:A_corner_in_Dong_Van_Market.jpg",
      widthPx: 4320,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Ha_Giang_market-_Dong_Van_market.jpg/1280px-Ha_Giang_market-_Dong_Van_market.jpg",
      credit: "Nghia Bui- Zonitrip",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ha_Giang_market-_Dong_Van_market.jpg",
      widthPx: 4000,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Covered_market_of_Dong_Van_in_2014.jpg/1280px-Covered_market_of_Dong_Van_in_2014.jpg",
      credit: "Vuong Tri Binh",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Covered_market_of_Dong_Van_in_2014.jpg",
      widthPx: 3552,
    },
  ],
  "ban-lo-lo-chai": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/HK_WC_Wan_Chai_Road_food_shop_%E7%B3%AF%E7%B1%B3%E9%9B%9E_Lo_mai_gai_November_2020_SS2_01.jpg/1280px-HK_WC_Wan_Chai_Road_food_shop_%E7%B3%AF%E7%B1%B3%E9%9B%9E_Lo_mai_gai_November_2020_SS2_01.jpg",
      credit: "GKOACOIT menuso",
      license: "CC BY-SA 4.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:HK_WC_Wan_Chai_Road_food_shop_%E7%B3%AF%E7%B1%B3%E9%9B%9E_Lo_mai_gai_November_2020_SS2_01.jpg",
      widthPx: 3264,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_03.JPG/1280px-Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_03.JPG",
      credit: "Mattoerelnapys",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_03.JPG",
      widthPx: 2048,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_01.JPG/1280px-Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_01.JPG",
      credit: "Mattoerelnapys",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_01.JPG",
      widthPx: 2048,
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_02.JPG/1280px-Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_02.JPG",
      credit: "Mattoerelnapys",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Chai_Wan_LO_Wing_Lok_Open_topless_yellow_automobile_Sept_2012_HK_02.JPG",
      widthPx: 2048,
    },
  ],
  "cho-tinh-khau-vai": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg/1280px-Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg",
      credit: "Hoangvantoanajc",
      license: "CC BY-SA 3.0",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ch%E1%BB%A3_t%C3%ACnh_Khau_Vai.jpg",
      widthPx: 2288,
    },
  ],
};

/**
 * Các slug KHÔNG tìm được ảnh đạt điều kiện ở lần chạy gần nhất. Ghi lại tường minh để
 * người đọc file biết đây là thiếu sót đã biết chứ không phải bỏ sót — và để `imageFor`
 * trong @data/website/types trả ảnh dự phòng thay vì một chuỗi rỗng.
 */
export const SLUGS_WITHOUT_IMAGE: string[] = [
  // doc-tham-ma (tìm "Tham Ma slope Ha Giang")
  // cong-troi-quan-ba (tìm "Quan Ba heaven gate")
  // nui-doi-co-tien (tìm "Quan Ba twin mountain")
  // thac-du-gia (tìm "Du Gia waterfall")
  // rung-thong-yen-minh (tìm "Yen Minh pine forest")
  // dinh-thu-ho-vuong (tìm "Vuong mansion Sa Phin")
  // ruong-bac-thang-hoang-su-phi (tìm "Hoang Su Phi terraced field")
  // doc-chin-khoanh (tìm "Sung La valley Ha Giang")
  // lung-tam (tìm "Lung Tam linen Ha Giang")
  // lang-det-lanh-lung-tam (tìm "Hmong linen weaving Ha Giang")
  // ban-nam-dam (tìm "Nam Dam Ha Giang")
  "doc-tham-ma",
  "cong-troi-quan-ba",
  "nui-doi-co-tien",
  "thac-du-gia",
  "rung-thong-yen-minh",
  "dinh-thu-ho-vuong",
  "ruong-bac-thang-hoang-su-phi",
  "doc-chin-khoanh",
  "lung-tam",
  "lang-det-lanh-lung-tam",
  "ban-nam-dam",
];
