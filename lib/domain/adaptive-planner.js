'use strict';

function isoDate(date) { return date.toISOString().slice(0, 10); }
function mondayOf(value = new Date()) {
  const date = new Date(`${isoDate(value)}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
}

function buildWeeklyPlan(recommendations, options = {}) {
  const weeklyMinutes = Math.max(60, Math.min(2400, Number(options.weeklyMinutes) || 420));
  const weekStart = mondayOf(options.startDate || new Date());
  if (!recommendations.length) return { weekStart: isoDate(weekStart), weeklyMinutes, tasks: [] };
  const taskCount = Math.min(7, Math.max(3, Math.round(weeklyMinutes / 60)), recommendations.length * 2);
  const weights = recommendations.map(item => Math.max(1, Number(item.priorityScore) || 1));
  const totalWeight = Array.from({ length: taskCount }, (_, index) => weights[index % weights.length]).reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  const tasks = Array.from({ length: taskCount }, (_, index) => {
    const recommendation = recommendations[index % recommendations.length];
    const isLast = index === taskCount - 1;
    const rawMinutes = isLast ? weeklyMinutes - assigned : Math.round(weeklyMinutes * weights[index % weights.length] / totalWeight / 5) * 5;
    const plannedMinutes = Math.max(20, rawMinutes);
    assigned += plannedMinutes;
    const date = new Date(weekStart); date.setUTCDate(date.getUTCDate() + index);
    return { topicId: recommendation.topicId, recommendationId: recommendation.id || null,
      taskType: recommendation.action, scheduledDate: isoDate(date), plannedMinutes,
      displayOrder: index + 1, reason: recommendation.reason };
  });
  const difference = weeklyMinutes - tasks.reduce((sum, item) => sum + item.plannedMinutes, 0);
  tasks[tasks.length - 1].plannedMinutes = Math.max(20, tasks[tasks.length - 1].plannedMinutes + difference);
  return { weekStart: isoDate(weekStart), weeklyMinutes: tasks.reduce((sum, item) => sum + item.plannedMinutes, 0), tasks };
}

module.exports = { buildWeeklyPlan, mondayOf };
