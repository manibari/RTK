import type { IGraphRepository } from "./types/repository.js";
import type { CharacterNode, RelationshipEdge, PlaceNode } from "./types/graph.js";

const S0 = { leadership: 0, tactics: 0, commerce: 0, espionage: 0 };

const characters: CharacterNode[] = [
  { id: "liu_bei", name: "劉備", traits: ["benevolent", "ambitious", "charismatic"], cityId: "taipei", military: 1, intelligence: 1, charm: 5, skills: { ...S0, leadership: 3 } },
  { id: "guan_yu", name: "關羽", traits: ["loyal", "brave", "proud"], cityId: "taipei", military: 4, intelligence: 1, charm: 0, skills: { ...S0, tactics: 2 } },
  { id: "zhang_fei", name: "張飛", traits: ["brave", "impulsive", "loyal"], cityId: "taoyuan", military: 4, intelligence: 0, charm: 1, skills: { ...S0, tactics: 1 } },
  { id: "zhuge_liang", name: "諸葛亮", traits: ["wise", "cautious", "strategic"], cityId: "hsinchu", military: 1, intelligence: 5, charm: 0, skills: { ...S0, espionage: 2, commerce: 1 } },
  { id: "cao_cao", name: "曹操", traits: ["ambitious", "cunning", "charismatic"], cityId: "taichung", military: 1, intelligence: 3, charm: 3, skills: { ...S0, leadership: 2, commerce: 1 } },
  { id: "sun_quan", name: "孫權", traits: ["cautious", "diplomatic", "ambitious"], cityId: "tainan", military: 1, intelligence: 3, charm: 3, skills: { ...S0, commerce: 2, leadership: 1 } },
  { id: "zhao_yun", name: "趙雲", traits: ["loyal", "brave", "humble"], cityId: "taipei", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 2 } },
  { id: "lu_bu", name: "呂布", traits: ["brave", "treacherous", "impulsive"], cityId: "kaohsiung", military: 4, intelligence: 0, charm: 0, skills: { ...S0, tactics: 3 } },
  { id: "diao_chan", name: "貂蟬", traits: ["charismatic", "cunning", "diplomatic"], cityId: "kaohsiung", military: 0, intelligence: 3, charm: 5, skills: { ...S0, espionage: 2, leadership: 1 } },
  { id: "zhou_yu", name: "周瑜", traits: ["strategic", "proud", "ambitious"], cityId: "tainan", military: 2, intelligence: 3, charm: 0, skills: { ...S0, tactics: 2, espionage: 1 } },
  // Neutral (unaffiliated) characters
  { id: "xu_shu", name: "徐庶", traits: ["wise", "loyal", "humble"], cityId: "chiayi", military: 1, intelligence: 4, charm: 2, skills: { ...S0, tactics: 1, espionage: 1 } },
  { id: "pang_tong", name: "龐統", traits: ["wise", "strategic", "cunning"], cityId: "hualien", military: 0, intelligence: 5, charm: 1, skills: { ...S0, tactics: 2, commerce: 1 } },
  { id: "huang_zhong", name: "黃忠", traits: ["brave", "loyal", "proud"], cityId: "chiayi", military: 5, intelligence: 0, charm: 1, skills: { ...S0, tactics: 3 } },
  { id: "ma_chao", name: "馬超", traits: ["brave", "impulsive", "ambitious"], cityId: "pingtung", military: 4, intelligence: 1, charm: 2, skills: { ...S0, tactics: 2, leadership: 1 } },
  { id: "gan_ning", name: "甘寧", traits: ["brave", "impulsive", "charismatic"], cityId: "keelung", military: 3, intelligence: 1, charm: 2, skills: { ...S0, tactics: 1, commerce: 1 } },
  { id: "xu_huang", name: "徐晃", traits: ["loyal", "brave", "cautious"], cityId: "pingtung", military: 3, intelligence: 2, charm: 1, skills: { ...S0, tactics: 2 } },
];

const cities: PlaceNode[] = [
  // Major cities (gold: 0, garrison: 2, development: 0, with specialty)
  { id: "taipei", name: "許都（台北）", lat: 25.033, lng: 121.565, status: "allied", tier: "major", controllerId: "liu_bei", gold: 0, garrison: 2, development: 0, specialty: "military_academy", food: 100 },
  { id: "taichung", name: "鄴城（台中）", lat: 24.147, lng: 120.674, status: "hostile", tier: "major", controllerId: "cao_cao", gold: 0, garrison: 2, development: 0, specialty: "forge", food: 100 },
  { id: "tainan", name: "建業（台南）", lat: 22.999, lng: 120.227, status: "neutral", tier: "major", controllerId: "sun_quan", gold: 0, garrison: 2, development: 0, specialty: "harbor", food: 100 },
  { id: "kaohsiung", name: "下邳（高雄）", lat: 22.627, lng: 120.301, status: "hostile", tier: "major", controllerId: "lu_bu", gold: 0, garrison: 2, development: 0, specialty: "market", food: 100 },
  // Minor cities (gold: 0, garrison: 1, development: 0, with specialty)
  { id: "taoyuan", name: "新野（桃園）", lat: 24.994, lng: 121.301, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 0, garrison: 1, development: 0, specialty: "granary", food: 60 },
  { id: "hsinchu", name: "隆中（新竹）", lat: 24.804, lng: 120.972, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 0, garrison: 1, development: 0, specialty: "library", food: 60 },
  { id: "chiayi", name: "長沙（嘉義）", lat: 23.480, lng: 120.449, status: "neutral", tier: "minor", gold: 0, garrison: 0, development: 0, specialty: "market", food: 60 },
  { id: "hualien", name: "南蠻（花蓮）", lat: 23.992, lng: 121.601, status: "dead", tier: "minor", gold: 0, garrison: 0, development: 0, specialty: "granary", food: 60 },
  { id: "keelung", name: "北海（基隆）", lat: 25.128, lng: 121.740, status: "allied", tier: "minor", controllerId: "liu_bei", gold: 0, garrison: 1, development: 0, specialty: "harbor", food: 60 },
  { id: "pingtung", name: "交州（屏東）", lat: 22.682, lng: 120.484, status: "neutral", tier: "minor", gold: 0, garrison: 0, development: 0, specialty: "forge", food: 60 },
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
