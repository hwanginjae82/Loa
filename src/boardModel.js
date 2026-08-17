export const dayDefinitions = [
  { key: "wed", label: "수", full: "수요일" },
  { key: "thu", label: "목", full: "목요일" },
  { key: "fri", label: "금", full: "금요일" },
  { key: "sat", label: "토", full: "토요일" },
  { key: "sun", label: "일", full: "일요일" },
  { key: "mon", label: "월", full: "월요일" },
  { key: "tue", label: "화", full: "화요일" },
];

export const scheduleDayKeys = [...dayDefinitions.map((day) => day.key), "mobile"];
export const defaultRaidTime = "20:30";
export const raidTimeOptions = ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00"];
export const palette = ["#ffd131", "#94d451", "#edaedf", "#f1c09f", "#9fc3ed", "#87e4e1", "#d7d7d7", "#dcb17a", "#c7b4f3", "#f3a6a6", "#a8d8b9", "#f6d58f", "#b7c9f2", "#d9a9c7", "#a9d9d4", "#c8b58d"];

export const raidColorDefaults = { gray: "#aaaaaa", blue: "#0f9dd2", gold: "#c49b00", yellow: "#f4d576", purple: "#85619e" };
const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00`);
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const raidTimeSortValue = (time) => {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hour, minute] = time.split(":").map(Number);
  const value = hour * 60 + minute;
  return value < 12 * 60 ? value + 24 * 60 : value;
};

export const shiftWeekKey = (dateKey, amount) => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount * 7);
  return toDateKey(date);
};

export const getCurrentWeekStart = (today = new Date()) => {
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() - 3 + 7) % 7));
  return toDateKey(date);
};

export const currentWeekStart = getCurrentWeekStart();
export const earliestVisibleWeekStart = shiftWeekKey(currentWeekStart, -4);
export const latestVisibleWeekStart = shiftWeekKey(currentWeekStart, 1);

export const clampVisibleWeek = (weekStart) => {
  if (weekStart < earliestVisibleWeekStart) return earliestVisibleWeekStart;
  if (weekStart > latestVisibleWeekStart) return latestVisibleWeekStart;
  return weekStart;
};

export const getCalendarWeekOfMonth = (date) => Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);

export const getWeekDays = (weekStart) => {
  const start = parseDateKey(weekStart);
  return [
    ...dayDefinitions.map((definition, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { ...definition, date: `${date.getMonth() + 1}/${date.getDate()}` };
    }),
    { key: "mobile", label: "모", full: "모바출", date: "날짜 조율" },
  ];
};

export const emptyRaidDays = () => Object.fromEntries(scheduleDayKeys.map((key) => [key, []]));
export const emptyScheduleData = () => ({ version: 2, weeks: {} });

export const normalizeRaidDays = (raids = {}) => Object.fromEntries(scheduleDayKeys.map((key) => {
  const normalized = (Array.isArray(raids[key]) ? raids[key] : []).map((instance) => ({
    ...instance,
    catalogId: instance.catalogId == null ? instance.catalogId : String(instance.catalogId),
    startTime: key === "mobile" ? "" : instance.startTime === "" ? "" : raidTimeOptions.includes(instance.startTime) ? instance.startTime : defaultRaidTime,
  }));
  const ordered = normalized.some((instance) => Number.isFinite(instance.order))
    ? [...normalized].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
    : [...normalized].sort((left, right) => raidTimeSortValue(left.startTime) - raidTimeSortValue(right.startTime));
  return [key, ordered.map((instance, index) => ({ ...instance, order: index }))];
}));

const characterNameFromId = (id) => typeof id === "string" && id.includes(":") ? id.slice(id.indexOf(":") + 1) : null;

const reconnectScheduleCharacters = (raids, members) => {
  const normalized = normalizeRaidDays(raids);
  const characters = members.flatMap((member) => member.characters);
  const currentNameById = new Map(characters.map((character) => [character.id, character.name]));
  const currentNames = new Set(characters.map((character) => character.name));
  return Object.fromEntries(Object.entries(normalized).map(([dayKey, instances]) => [dayKey, instances.map((instance) => ({
    ...instance,
    characterIds: instance.characterIds.map((id) => {
      if (!id || currentNames.has(id)) return id;
      const characterName = currentNameById.get(id) ?? characterNameFromId(id);
      return currentNames.has(characterName) ? characterName : id;
    }),
  }))]));
};

export const getRaidColor = (raid) => raid.hexColor ?? raidColorDefaults[raid.color] ?? "#aaaaaa";

const raidDifficultyOrder = (difficulty = "") => {
  const stage = difficulty.match(/^(\d+)단계$/);
  if (stage) return Number(stage[1]);
  return { 노말: 1, 하드: 2, 나메: 3 }[difficulty] ?? 99;
};

export const sortRaidCatalog = (catalog) => {
  const nameOrder = new Map();
  catalog.forEach((raid) => {
    if (!nameOrder.has(raid.name)) nameOrder.set(raid.name, nameOrder.size);
  });
  return [...catalog].sort((left, right) => nameOrder.get(left.name) - nameOrder.get(right.name) || raidDifficultyOrder(left.difficulty) - raidDifficultyOrder(right.difficulty));
};

export const normalizeMembers = (members) => members.map((member, index) => ({
  ...member,
  color: member.color ?? palette[index % palette.length],
  characters: member.characters.map((character, characterIndex) => ({
    ...character,
    earnsGold: character.earnsGold ?? characterIndex < 6,
  })),
}));

export const normalizeCatalog = (catalog) => {
  const incoming = Array.isArray(catalog) ? catalog : [];
  return sortRaidCatalog(incoming.map((raid) => ({ ...raid, id: String(raid.id), hexColor: getRaidColor(raid) })));
};

export const normalizeScheduleData = (schedule, members) => {
  if (!schedule || typeof schedule !== "object") return emptyScheduleData();
  if (schedule.version === 2 && schedule.weeks) {
    return {
      ...schedule,
      weeks: Object.fromEntries(Object.entries(schedule.weeks).map(([weekStart, week]) => [weekStart, {
        raids: reconnectScheduleCharacters(week.raids, members),
        unavailableByMember: week.unavailableByMember ?? {},
      }])),
    };
  }
  return {
    version: 2,
    weeks: {
      [currentWeekStart]: {
        raids: reconnectScheduleCharacters(schedule, members),
        unavailableByMember: Object.fromEntries(members.filter((member) => member.unavailable?.length).map((member) => [String(member.id), member.unavailable])),
      },
    },
  };
};

export const findRosterCharacter = (roster, reference) => roster.find((character) => character.id === reference || character.name === reference);
