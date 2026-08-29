export type PhysicalEvent = {
  code: string;
  name: string;
  unit: "m" | "repeticoes" | "segundos";
  direction: "higher" | "lower";
  description: string;
};

export type PhysicalGoal = {
  eventCode: string;
  targetValue: number;
  goalSource: "personal" | "validated_notice";
  isOfficial: boolean;
  updatedAt: string;
};

export type PhysicalResult = {
  id: string;
  eventCode: string;
  value: number;
  measuredAt: string;
  notes: string | null;
};

export type Mission = {
  code: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  xp: number;
};

export type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
};

export type GamificationSnapshot = {
  missions: Mission[];
  achievements: Achievement[];
  completedMissions: number;
};
