export interface SimulationEvent {
  tick: number;
  timestamp: number;
  actorId: string;
  targetId: string;
  eventCode: string;
  resultDelta: {
    relation: string;
    intimacyChange: number;
    oldIntimacy: number;
    newIntimacy: number;
  };
}
