export interface StoredEvent {
  id: number;
  tick: number;
  timestamp: number;
  actorId: string;
  targetId: string;
  eventCode: string;
  intimacyChange: number;
  oldIntimacy: number;
  newIntimacy: number;
  relation: string;
  narrative: string;
}

export interface IEventStore {
  append(events: Omit<StoredEvent, "id">[]): void;
  updateNarratives(updates: { id: number; narrative: string }[]): void;
  getByCharacter(characterId: string, fromTick?: number, toTick?: number): StoredEvent[];
  getByPair(actorId: string, targetId: string, fromTick?: number, toTick?: number): StoredEvent[];
  getByTickRange(fromTick: number, toTick: number): StoredEvent[];
  getAll(): StoredEvent[];
  close(): void;
}
