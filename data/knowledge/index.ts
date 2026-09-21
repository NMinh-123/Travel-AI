import { DESCRIPTION_KNOWLEDGE } from "@data/knowledge/descriptions";
import { HISTORY_KNOWLEDGE } from "@data/knowledge/history";
import { CULTURE_KNOWLEDGE } from "@data/knowledge/culture";
import { CUISINE_KNOWLEDGE } from "@data/knowledge/cuisine";
import { SIGHTSEEING_KNOWLEDGE } from "@data/knowledge/sightseeing";
import { ACCOMMODATION_KNOWLEDGE } from "@data/knowledge/accommodation";
import { TRAVEL_GUIDE_KNOWLEDGE } from "@data/knowledge/travel-guide";
import { POLICY_KNOWLEDGE } from "@data/knowledge/policy";
import type { KnowledgeSourceDoc } from "@data/knowledge/types";

export type {
  KnowledgeSourceDoc,
  KnowledgeDomain,
  KnowledgeEntityType,
  KnowledgeSourceClass,
  Season,
  WebSource,
} from "@data/knowledge/types";

export { DESCRIPTION_KNOWLEDGE } from "@data/knowledge/descriptions";
export { HISTORY_KNOWLEDGE } from "@data/knowledge/history";
export { CULTURE_KNOWLEDGE } from "@data/knowledge/culture";
export { CUISINE_KNOWLEDGE } from "@data/knowledge/cuisine";
export { SIGHTSEEING_KNOWLEDGE } from "@data/knowledge/sightseeing";
export { ACCOMMODATION_KNOWLEDGE } from "@data/knowledge/accommodation";
export { TRAVEL_GUIDE_KNOWLEDGE } from "@data/knowledge/travel-guide";
export { POLICY_KNOWLEDGE } from "@data/knowledge/policy";
export { WEB_SOURCES } from "@data/knowledge/web-sources";

/**
 * Toàn bộ kho tri thức, gộp tám tệp nguồn theo đúng sáu mặt nội dung của SRS Mục 11.1.1.5.
 *
 * `scripts/ingest-knowledge.ts` chỉ nên đọc hằng này chứ không import từng file: thêm một mặt
 * nội dung mới thì sửa ở đây một lần, còn quên sửa script ingest là thêm cả một nhóm tri thức mà
 * không ai nạp — và đó là loại lỗi không báo gì cả, chỉ biểu hiện thành "chatbot không biết về
 * chuyện đó".
 */
export const ALL_KNOWLEDGE: KnowledgeSourceDoc[] = [
  ...DESCRIPTION_KNOWLEDGE,
  ...HISTORY_KNOWLEDGE,
  ...CULTURE_KNOWLEDGE,
  ...CUISINE_KNOWLEDGE,
  ...SIGHTSEEING_KNOWLEDGE,
  ...ACCOMMODATION_KNOWLEDGE,
  ...TRAVEL_GUIDE_KNOWLEDGE,
  ...POLICY_KNOWLEDGE,
];
