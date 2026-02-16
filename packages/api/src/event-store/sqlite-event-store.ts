import Database from "better-sqlite3";
import type { IEventStore, StoredEvent } from "./types.js";

export class SqliteEventStore implements IEventStore {
  private db: Database.Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tick INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        event_code TEXT NOT NULL,
        intimacy_change INTEGER NOT NULL,
        old_intimacy INTEGER NOT NULL,
        new_intimacy INTEGER NOT NULL,
        relation TEXT NOT NULL,
        narrative TEXT NOT NULL DEFAULT ''
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_tick ON events(tick)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_target ON events(target_id)`);
  }

  append(events: Omit<StoredEvent, "id">[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO events (tick, timestamp, actor_id, target_id, event_code, intimacy_change, old_intimacy, new_intimacy, relation, narrative)
      VALUES (@tick, @timestamp, @actorId, @targetId, @eventCode, @intimacyChange, @oldIntimacy, @newIntimacy, @relation, @narrative)
    `);

    const insertMany = this.db.transaction((evts: Omit<StoredEvent, "id">[]) => {
      for (const e of evts) stmt.run(e);
    });

    insertMany(events);
  }

  updateNarratives(updates: { id: number; narrative: string }[]): void {
    const stmt = this.db.prepare(`UPDATE events SET narrative = ? WHERE id = ?`);
    const updateMany = this.db.transaction((items: { id: number; narrative: string }[]) => {
      for (const item of items) stmt.run(item.narrative, item.id);
    });
    updateMany(updates);
  }

  getByCharacter(characterId: string, fromTick?: number, toTick?: number): StoredEvent[] {
    let sql = `SELECT * FROM events WHERE (actor_id = ? OR target_id = ?)`;
    const params: (string | number)[] = [characterId, characterId];

    if (fromTick !== undefined) {
      sql += ` AND tick >= ?`;
      params.push(fromTick);
    }
    if (toTick !== undefined) {
      sql += ` AND tick <= ?`;
      params.push(toTick);
    }
    sql += ` ORDER BY tick ASC, id ASC`;

    return this.db.prepare(sql).all(...params).map(rowToEvent);
  }

  getByPair(actorId: string, targetId: string, fromTick?: number, toTick?: number): StoredEvent[] {
    let sql = `SELECT * FROM events WHERE
      ((actor_id = ? AND target_id = ?) OR (actor_id = ? AND target_id = ?))`;
    const params: (string | number)[] = [actorId, targetId, targetId, actorId];

    if (fromTick !== undefined) {
      sql += ` AND tick >= ?`;
      params.push(fromTick);
    }
    if (toTick !== undefined) {
      sql += ` AND tick <= ?`;
      params.push(toTick);
    }
    sql += ` ORDER BY tick ASC, id ASC`;

    return this.db.prepare(sql).all(...params).map(rowToEvent);
  }

  getByTickRange(fromTick: number, toTick: number): StoredEvent[] {
    return this.db
      .prepare(`SELECT * FROM events WHERE tick >= ? AND tick <= ? ORDER BY tick ASC, id ASC`)
      .all(fromTick, toTick)
      .map(rowToEvent);
  }

  getAll(): StoredEvent[] {
    return this.db
      .prepare(`SELECT * FROM events ORDER BY tick ASC, id ASC`)
      .all()
      .map(rowToEvent);
  }

  close(): void {
    this.db.close();
  }
}

function rowToEvent(row: unknown): StoredEvent {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as number,
    tick: r.tick as number,
    timestamp: r.timestamp as number,
    actorId: r.actor_id as string,
    targetId: r.target_id as string,
    eventCode: r.event_code as string,
    intimacyChange: r.intimacy_change as number,
    oldIntimacy: r.old_intimacy as number,
    newIntimacy: r.new_intimacy as number,
    relation: r.relation as string,
    narrative: (r.narrative as string) ?? "",
  };
}
