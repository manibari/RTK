import Anthropic from "@anthropic-ai/sdk";
import type { StoredEvent } from "../event-store/types.js";

interface CharacterInfo {
  id: string;
  name: string;
  traits: string[];
}

export interface NarrativeResult {
  eventId: number;
  narrative: string;
}

export class NarrativeService {
  private client: Anthropic | null = null;
  private characterMap: Map<string, CharacterInfo>;

  constructor(characterMap: Map<string, CharacterInfo>) {
    this.characterMap = characterMap;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      console.log("NarrativeService: Claude API enabled");
    } else {
      console.log("NarrativeService: No ANTHROPIC_API_KEY, using template fallback");
    }
  }

  get isLLMEnabled(): boolean {
    return this.client !== null;
  }

  async generateNarratives(events: StoredEvent[]): Promise<NarrativeResult[]> {
    if (events.length === 0) return [];

    if (!this.client) {
      return events.map((e) => ({
        eventId: e.id,
        narrative: this.templateNarrative(e),
      }));
    }

    return this.llmNarratives(events);
  }

  async generateDailySummary(tick: number, events: StoredEvent[]): Promise<string> {
    if (events.length === 0) return `第 ${tick} 天，天下太平，無事發生。`;

    if (!this.client) {
      return this.templateDailySummary(tick, events);
    }

    return this.llmDailySummary(tick, events);
  }

  private async llmNarratives(events: StoredEvent[]): Promise<NarrativeResult[]> {
    const eventsDescription = events.map((e) => {
      const actor = this.characterMap.get(e.actorId);
      const target = this.characterMap.get(e.targetId);
      return {
        id: e.id,
        actor: actor?.name ?? e.actorId,
        actorTraits: actor?.traits ?? [],
        target: target?.name ?? e.targetId,
        targetTraits: target?.traits ?? [],
        change: e.intimacyChange,
        oldIntimacy: e.oldIntimacy,
        newIntimacy: e.newIntimacy,
        relation: e.relation,
      };
    }).map((e) =>
      `[ID:${e.id}] ${e.actor}(${e.actorTraits.join(",")}) → ${e.target}(${e.targetTraits.join(",")}): ` +
      `好感度 ${e.oldIntimacy}→${e.newIntimacy} (${e.change > 0 ? "+" : ""}${e.change}), 關係: ${e.relation}`
    ).join("\n");

    try {
      const response = await this.client!.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `你是三國時代的史官。以下是今日發生的人物互動事件，請為每個事件寫一句簡短的敘事描述（20-40字），要符合三國世界觀。

格式要求：每行一個，格式為 [ID:數字] 敘事文字
不要加其他說明。

事件列表：
${eventsDescription}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return this.parseLLMNarratives(events, text);
    } catch (err) {
      console.error("LLM narrative generation failed, falling back to template:", err);
      return events.map((e) => ({
        eventId: e.id,
        narrative: this.templateNarrative(e),
      }));
    }
  }

  private parseLLMNarratives(events: StoredEvent[], llmText: string): NarrativeResult[] {
    const lines = llmText.trim().split("\n");
    const parsed = new Map<number, string>();

    for (const line of lines) {
      const match = line.match(/\[ID:(\d+)\]\s*(.+)/);
      if (match) {
        parsed.set(Number(match[1]), match[2].trim());
      }
    }

    return events.map((e) => ({
      eventId: e.id,
      narrative: parsed.get(e.id) ?? this.templateNarrative(e),
    }));
  }

  private async llmDailySummary(tick: number, events: StoredEvent[]): Promise<string> {
    const highlights = events
      .sort((a, b) => Math.abs(b.intimacyChange) - Math.abs(a.intimacyChange))
      .slice(0, 5)
      .map((e) => {
        const actor = this.characterMap.get(e.actorId)?.name ?? e.actorId;
        const target = this.characterMap.get(e.targetId)?.name ?? e.targetId;
        return `${actor}↔${target}: ${e.intimacyChange > 0 ? "+" : ""}${e.intimacyChange}`;
      })
      .join(", ");

    try {
      const response = await this.client!.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{
          role: "user",
          content: `你是三國時代的史官。今天是第 ${tick} 天。以下是今日重要的人物關係變化：
${highlights}

請用 2-3 句話寫一段今日總結（像史書的風格），不超過 80 字。`,
        }],
      });

      return response.content[0].type === "text"
        ? response.content[0].text.trim()
        : this.templateDailySummary(tick, events);
    } catch {
      return this.templateDailySummary(tick, events);
    }
  }

  // --- Template fallbacks ---

  private templateNarrative(event: StoredEvent): string {
    const actor = this.characterMap.get(event.actorId)?.name ?? event.actorId;
    const target = this.characterMap.get(event.targetId)?.name ?? event.targetId;
    const abs = Math.abs(event.intimacyChange);

    if (event.intimacyChange > 0) {
      const verb = abs >= 4 ? "意氣相投，相談甚歡" : abs >= 2 ? "交談融洽" : "點頭致意";
      return `${actor}與${target}${verb}，好感度上升。`;
    }
    const verb = abs >= 4 ? "言語不和，心生嫌隙" : abs >= 2 ? "話不投機" : "略有摩擦";
    return `${actor}與${target}${verb}，好感度下降。`;
  }

  private templateDailySummary(tick: number, events: StoredEvent[]): string {
    const positive = events.filter((e) => e.intimacyChange > 0).length;
    const negative = events.filter((e) => e.intimacyChange < 0).length;
    const biggest = events.reduce((a, b) =>
      Math.abs(a.intimacyChange) > Math.abs(b.intimacyChange) ? a : b
    );
    const bigActor = this.characterMap.get(biggest.actorId)?.name ?? biggest.actorId;
    const bigTarget = this.characterMap.get(biggest.targetId)?.name ?? biggest.targetId;

    return `第 ${tick} 天，共 ${events.length} 起互動（${positive} 正面、${negative} 負面）。` +
      `其中${bigActor}與${bigTarget}的變化最為顯著（${biggest.intimacyChange > 0 ? "+" : ""}${biggest.intimacyChange}）。`;
  }
}
