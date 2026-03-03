const GAME_START_YEAR = 184;

export function formatGameDate(tick: number): string {
  const year = GAME_START_YEAR + Math.floor(tick / 12);
  const month = (tick % 12) + 1;
  return `${year}年${month}月`;
}
