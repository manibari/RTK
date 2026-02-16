import type { IGraphRepository } from "./types/repository.js";
import type { CharacterNode, RelationshipEdge, PlaceNode } from "./types/graph.js";

const characters: CharacterNode[] = [
  { id: "liu_bei", name: "劉備", traits: ["benevolent", "ambitious", "charismatic"], cityId: "taipei" },
  { id: "guan_yu", name: "關羽", traits: ["loyal", "brave", "proud"], cityId: "taipei" },
  { id: "zhang_fei", name: "張飛", traits: ["brave", "impulsive", "loyal"], cityId: "taoyuan" },
  { id: "zhuge_liang", name: "諸葛亮", traits: ["wise", "cautious", "strategic"], cityId: "hsinchu" },
  { id: "cao_cao", name: "曹操", traits: ["ambitious", "cunning", "charismatic"], cityId: "taichung" },
  { id: "sun_quan", name: "孫權", traits: ["cautious", "diplomatic", "ambitious"], cityId: "tainan" },
  { id: "zhao_yun", name: "趙雲", traits: ["loyal", "brave", "humble"], cityId: "taipei" },
  { id: "lu_bu", name: "呂布", traits: ["brave", "treacherous", "impulsive"], cityId: "kaohsiung" },
  { id: "diao_chan", name: "貂蟬", traits: ["charismatic", "cunning", "diplomatic"], cityId: "kaohsiung" },
  { id: "zhou_yu", name: "周瑜", traits: ["strategic", "proud", "ambitious"], cityId: "tainan" },
];

const cities: PlaceNode[] = [
  // Major cities
  { id: "taipei", name: "許都（台北）", lat: 25.033, lng: 121.565, status: "allied", tier: "major", controllerId: "liu_bei" },
  { id: "taichung", name: "鄴城（台中）", lat: 24.147, lng: 120.674, status: "hostile", tier: "major", controllerId: "cao_cao" },
  { id: "tainan", name: "建業（台南）", lat: 22.999, lng: 120.227, status: "neutral", tier: "major", controllerId: "sun_quan" },
  { id: "kaohsiung", name: "下邳（高雄）", lat: 22.627, lng: 120.301, status: "hostile", tier: "major", controllerId: "lu_bu" },
  // Minor cities
  { id: "taoyuan", name: "新野（桃園）", lat: 24.994, lng: 121.301, status: "allied", tier: "minor", controllerId: "liu_bei" },
  { id: "hsinchu", name: "隆中（新竹）", lat: 24.804, lng: 120.972, status: "allied", tier: "minor", controllerId: "liu_bei" },
  { id: "chiayi", name: "長沙（嘉義）", lat: 23.480, lng: 120.449, status: "neutral", tier: "minor" },
  { id: "hualien", name: "南蠻（花蓮）", lat: 23.992, lng: 121.601, status: "dead", tier: "minor" },
  { id: "keelung", name: "北海（基隆）", lat: 25.128, lng: 121.740, status: "allied", tier: "minor", controllerId: "liu_bei" },
  { id: "pingtung", name: "交州（屏東）", lat: 22.682, lng: 120.484, status: "neutral", tier: "minor" },
];

const relationships: RelationshipEdge[] = [
  // 桃園三結義
  { sourceId: "liu_bei", targetId: "guan_yu", intimacy: 95, relationshipType: "friend" },
  { sourceId: "liu_bei", targetId: "zhang_fei", intimacy: 90, relationshipType: "friend" },
  { sourceId: "guan_yu", targetId: "zhang_fei", intimacy: 85, relationshipType: "friend" },

  // 劉備陣營
  { sourceId: "liu_bei", targetId: "zhuge_liang", intimacy: 92, relationshipType: "friend" },
  { sourceId: "liu_bei", targetId: "zhao_yun", intimacy: 88, relationshipType: "friend" },
  { sourceId: "zhuge_liang", targetId: "zhao_yun", intimacy: 70, relationshipType: "friend" },

  // 對立關係
  { sourceId: "liu_bei", targetId: "cao_cao", intimacy: 20, relationshipType: "rival" },
  { sourceId: "guan_yu", targetId: "cao_cao", intimacy: 45, relationshipType: "neutral" },
  { sourceId: "zhuge_liang", targetId: "zhou_yu", intimacy: 35, relationshipType: "rival" },

  // 孫劉聯盟（微妙）
  { sourceId: "liu_bei", targetId: "sun_quan", intimacy: 50, relationshipType: "neutral" },
  { sourceId: "zhuge_liang", targetId: "sun_quan", intimacy: 55, relationshipType: "neutral" },
  { sourceId: "zhou_yu", targetId: "sun_quan", intimacy: 80, relationshipType: "friend" },

  // 呂布 — 人人喊打
  { sourceId: "lu_bu", targetId: "cao_cao", intimacy: 15, relationshipType: "rival" },
  { sourceId: "lu_bu", targetId: "liu_bei", intimacy: 25, relationshipType: "rival" },
  { sourceId: "lu_bu", targetId: "diao_chan", intimacy: 85, relationshipType: "friend" },

  // 貂蟬的計謀
  { sourceId: "diao_chan", targetId: "cao_cao", intimacy: 40, relationshipType: "neutral" },
];

export async function seedData(repo: IGraphRepository): Promise<void> {
  for (const city of cities) {
    await repo.createPlace(city);
  }
  for (const character of characters) {
    await repo.createCharacter(character);
  }
  for (const relationship of relationships) {
    await repo.setRelationship(relationship);
  }
}

export { characters, relationships, cities };
