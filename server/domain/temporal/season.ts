import type { Season } from "@data/knowledge/types";

// Nguồn: data/knowledge/sightseeing.ts, slug kinh-nghiem-hoa-cai-hoa-dao;
// khoảng tháng cụ thể dùng chú thích Season trong data/knowledge/types.ts.
// Mưa: travel-guide.ts, slug guide-an-toan-duong-deo-mua-mua-va-sat-lo.
// Lúa: sightseeing.ts, slug kinh-nghiem-lua-chin-hoang-su-phi.
// Tam giác mạch: sightseeing.ts, slug kinh-nghiem-tam-giac-mach-o-dau và
// accommodation.ts (mùa hoa tháng mười, mười một).
const SEASON_BY_MONTH: Readonly<Record<number, readonly Season[]>> = {
  1: ["hoa_cai", "hoa_dao_man", "mua_lanh"], // Hoa cải/đào/mận và rét.
  2: ["hoa_dao_man"],
  3: ["hoa_dao_man"],
  4: [],
  5: [],
  6: ["mua_mua"],
  7: ["mua_mua"],
  8: ["mua_mua"],
  9: ["lua_chin"],
  10: ["hoa_tam_giac_mach"],
  11: ["hoa_tam_giac_mach"],
  12: ["hoa_cai", "mua_lanh"],
};

export function seasonsForMonth(month: number): Season[] {
  return [...(SEASON_BY_MONTH[month] ?? [])];
}

export const SEASON_LABELS: Readonly<Record<Season, string>> = {
  hoa_tam_giac_mach: "hoa tam giác mạch",
  lua_chin: "lúa chín",
  hoa_cai: "hoa cải",
  hoa_dao_man: "hoa đào, hoa mận",
  mua_mua: "mùa mưa, nguy cơ sạt lở",
  mua_lanh: "mùa lạnh, có thể có băng giá trên đèo",
  quanh_nam: "quanh năm",
};
