import type { IGraphRepository } from "./types/repository.js";
import type { CharacterNode, RelationshipEdge } from "./types/graph.js";

const characters: CharacterNode[] = [
  { id: "liu_bei", name: "劉備", traits: ["benevolent", "ambitious", "charismatic"] },
  { id: "guan_yu", name: "關羽", traits: ["loyal", "brave", "proud"] },
  { id: "zhang_fei", name: "張飛", traits: ["brave", "impulsive", "loyal"] },
  { id: "zhuge_liang", name: "諸葛亮", traits: ["wise", "cautious", "strategic"] },
  { id: "cao_cao", name: "曹操", traits: ["ambitious", "cunning", "charismatic"] },
  { id: "sun_quan", name: "孫權", traits: ["cautious", "diplomatic", "ambitious"] },
  { id: "zhao_yun", name: "趙雲", traits: ["loyal", "brave", "humble"] },
  { id: "lu_bu", name: "呂布", traits: ["brave", "treacherous", "impulsive"] },
  { id: "diao_chan", name: "貂蟬", traits: ["charismatic", "cunning", "diplomatic"] },
  { id: "zhou_yu", name: "周瑜", traits: ["strategic", "proud", "ambitious"] },
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
  for (const character of characters) {
    await repo.createCharacter(character);
  }
  for (const relationship of relationships) {
    await repo.setRelationship(relationship);
  }
}

export { characters, relationships };
