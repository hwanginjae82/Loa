import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { initialGuildMembers } from "./initialGuildMembers.js";
import { supabase } from "./supabase.js";
import { SaveChangesBar } from "./SaveChangesBar.jsx";
import { canDeleteScheduledRaid, removeScheduledRaid } from "./scheduledRaidDeletion.js";
import "./scheduledRaidDeletion.css";
import { migrateRosterSchedule } from "./rosterRefreshMigration.js";
import { ClassIcon } from "./classIcons.jsx";

const initialWeekStart = "2026-08-12";
const dayDefinitions = [
  { key: "wed", label: "수", full: "수요일" }, { key: "thu", label: "목", full: "목요일" },
  { key: "fri", label: "금", full: "금요일" }, { key: "sat", label: "토", full: "토요일" },
  { key: "sun", label: "일", full: "일요일" }, { key: "mon", label: "월", full: "월요일" },
  { key: "tue", label: "화", full: "화요일" },
];
const scheduleDayKeys = [...dayDefinitions.map((day) => day.key), "mobile"];
const defaultRaidTime = "20:30";
const raidTimeOptions = ["20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00"];
const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00`);
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftWeekKey = (dateKey, amount) => { const date = parseDateKey(dateKey); date.setDate(date.getDate() + amount * 7); return toDateKey(date); };
const getCurrentWeekStart = (today = new Date()) => {
  const date = new Date(today); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() - 3 + 7) % 7));
  return toDateKey(date);
};
const currentWeekStart = getCurrentWeekStart();
const earliestVisibleWeekStart = shiftWeekKey(currentWeekStart, -4);
const latestVisibleWeekStart = shiftWeekKey(currentWeekStart, 1);
const clampVisibleWeek = (weekStart) => weekStart < earliestVisibleWeekStart ? earliestVisibleWeekStart : weekStart > latestVisibleWeekStart ? latestVisibleWeekStart : weekStart;
const getCalendarWeekOfMonth = (date) => Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
const getWeekDays = (weekStart) => {
  const start = parseDateKey(weekStart);
  return [...dayDefinitions.map((definition, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index);
    return { ...definition, date: `${date.getMonth() + 1}/${date.getDate()}` };
  }), { key: "mobile", label: "모", full: "모바출", date: "날짜 조율" }];
};
const emptyRaidDays = () => Object.fromEntries(scheduleDayKeys.map((key) => [key, []]));
const normalizeRaidDays = (raids = {}) => Object.fromEntries(scheduleDayKeys.map((key) => {
  const normalized = (Array.isArray(raids[key]) ? raids[key] : []).map((instance) => ({
    ...instance,
    startTime: key === "mobile" ? "" : instance.startTime === "" ? "" : raidTimeOptions.includes(instance.startTime) ? instance.startTime : defaultRaidTime,
  }));
  const ordered = normalized.some((instance) => Number.isFinite(instance.order))
    ? [...normalized].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
    : [...normalized].sort((left, right) => raidTimeSortValue(left.startTime) - raidTimeSortValue(right.startTime));
  return [key, ordered.map((instance, index) => ({ ...instance, order: index }))];
}));
const legacyCharacterNameById = new Map([
  ...initialGuildMembers.flatMap((member) => member.characters.map((character) => [character.id, character.name])),
  ["guild-3-extra-1", "블레이드자쿠"],
  ["guild-5-extra-1", "테네오"],
]);
const characterNameFromId = (id) => legacyCharacterNameById.get(id) ?? (typeof id === "string" && id.includes(":") ? id.slice(id.indexOf(":") + 1) : null);
const reconnectScheduleCharacters = (raids, members) => {
  const normalized = normalizeRaidDays(raids);
  const characters = members.flatMap((member) => member.characters);
  const currentIds = new Set(characters.map((character) => character.id));
  const currentIdByName = new Map(characters.map((character) => [character.name, character.id]));
  return Object.fromEntries(Object.entries(normalized).map(([dayKey, instances]) => [dayKey, instances.map((instance) => ({
    ...instance,
    characterIds: instance.characterIds.map((id) => {
      if (!id || currentIds.has(id)) return id;
      const characterName = characterNameFromId(id);
      return currentIdByName.get(characterName) ?? id;
    }),
  }))]));
};
const raidTimeSortValue = (time) => { if (!time) return Number.MAX_SAFE_INTEGER; const [hour, minute] = time.split(":").map(Number); const value = hour * 60 + minute; return value < 12 * 60 ? value + 24 * 60 : value; };

const palette = ["#ffd131", "#94d451", "#edaedf", "#f1c09f", "#9fc3ed", "#87e4e1", "#d7d7d7", "#dcb17a", "#c7b4f3", "#f3a6a6", "#a8d8b9", "#f6d58f", "#b7c9f2", "#d9a9c7", "#a9d9d4", "#c8b58d"];
const raidColorDefaults = { gray: "#aaaaaa", blue: "#0f9dd2", gold: "#c49b00", yellow: "#f4d576", purple: "#85619e" };
const getRaidColor = (raid) => raid.hexColor ?? raidColorDefaults[raid.color] ?? "#aaaaaa";
const raidDifficultyOrder = (difficulty = "") => {
  const stage = difficulty.match(/^(\d+)단계$/);
  if (stage) return Number(stage[1]);
  return { 노말: 1, 하드: 2, 나메: 3 }[difficulty] ?? 99;
};
const sortRaidCatalog = (catalog) => {
  const nameOrder = new Map();
  catalog.forEach((raid) => { if (!nameOrder.has(raid.name)) nameOrder.set(raid.name, nameOrder.size); });
  return [...catalog].sort((left, right) => nameOrder.get(left.name) - nameOrder.get(right.name) || raidDifficultyOrder(left.difficulty) - raidDifficultyOrder(right.difficulty));
};
const normalizeMembers = (members) => {
  const colorById = new Map(initialGuildMembers.map((member, index) => [member.id, palette[index % palette.length]]));
  return members.map((member, index) => ({
    ...member,
    color: member.color ?? colorById.get(member.id) ?? palette[index % palette.length],
    characters: member.characters.map((character, characterIndex) => ({ ...character, earnsGold: character.earnsGold ?? characterIndex < 6 })),
  }));
};
const normalizeCatalog = (catalog) => {
  const incoming = Array.isArray(catalog) ? catalog : initialCatalog;
  return sortRaidCatalog(incoming.map((raid) => ({ ...raid, hexColor: getRaidColor(raid) })));
};
const normalizeScheduleData = (schedule, members) => {
  if (schedule?.version === 2 && schedule.weeks) {
    return { ...schedule, weeks: Object.fromEntries(Object.entries(schedule.weeks).map(([weekStart, week]) => [weekStart, { raids: reconnectScheduleCharacters(week.raids, members), unavailableByMember: week.unavailableByMember ?? {} }])) };
  }
  return { version: 2, weeks: { [initialWeekStart]: { raids: reconnectScheduleCharacters(schedule, members), unavailableByMember: Object.fromEntries(members.filter((member) => member.unavailable?.length).map((member) => [String(member.id), member.unavailable])) } } };
};
const char = (id, name, className, role, itemLevel) => ({ id, name, className, role, itemLevel });

const initialMembers = [
  { id: 1, name: "스카치", unavailable: ["fri"], characters: [
    char("s1", "스카치홀리", "홀리나이트", "서폿", 1760), char("s2", "스카치도화가", "도화가", "서폿", 1755),
    char("s3", "스카치차원", "소서리스", "딜러", 1745), char("s4", "스카치망식", "브레이커", "딜러", 1770),
    char("s5", "스카치블래", "블래스터", "딜러", 1740), char("s6", "스카치검객", "슬레이어", "딜러", 1750),
  ]},
  { id: 2, name: "저쿠", unavailable: ["thu"], characters: [
    char("j1", "저쿠환수사", "환수사", "딜러", 1762), char("j2", "저쿠블래", "블래스터", "딜러", 1752),
    char("j3", "저쿠유붕", "기공사", "딜러", 1750), char("j4", "저쿠우산", "기상술사", "딜러", 1745),
    char("j5", "저쿠발키리", "발키리", "서폿", 1740), char("j6", "저쿠소서", "소서리스", "딜러", 1735),
  ]},
  { id: 3, name: "아푸님", unavailable: ["wed", "sun"], characters: [
    char("a1", "아리드뭉아", "데모닉", "딜러", 1742), char("a2", "아리드예용", "바드", "서폿", 1760),
    char("a3", "아리드로님", "홀리나이트", "서폿", 1750), char("a4", "아리드바드", "바드", "서폿", 1740),
    char("a5", "아리드소울", "소울이터", "딜러", 1755), char("a6", "아푸님", "도화가", "서폿", 1735),
  ]},
  { id: 4, name: "김밥", unavailable: [], characters: [
    char("k1", "김밥붕기사", "기공사", "딜러", 1770), char("k2", "김밥홀리", "홀리나이트", "서폿", 1760),
    char("k3", "김밥블래", "블래스터", "딜러", 1755), char("k4", "김밥딜러", "버서커", "딜러", 1740),
    char("k5", "김밥든", "디스트로이어", "딜러", 1735), char("k6", "김밥버커", "버서커", "딜러", 1750),
  ]},
  { id: 5, name: "모민축", unavailable: ["sat"], characters: [
    char("m1", "모민축", "홀리나이트", "서폿", 1745), char("m2", "모카도화가", "도화가", "서폿", 1755),
    char("m3", "모카요거트", "바드", "서폿", 1750), char("m4", "모카소울", "소울이터", "딜러", 1735),
  ]},
  { id: 6, name: "해해", unavailable: ["mon"], characters: [
    char("h1", "해해소울", "소울이터", "딜러", 1751), char("h2", "해해발키리", "발키리", "서폿", 1745),
    char("h3", "해해기상", "기상술사", "딜러", 1755), char("h4", "해해베마", "배틀마스터", "딜러", 1735),
  ]},
  { id: 7, name: "안나범", unavailable: ["thu"], characters: [
    char("n1", "안나범기공", "기공사", "딜러", 1748), char("n2", "안나범기상", "기상술사", "딜러", 1760),
    char("n3", "안나범발키리", "발키리", "서폿", 1750), char("n4", "안나범환수사", "환수사", "딜러", 1740),
  ]},
  { id: 8, name: "반아", unavailable: ["tue"], characters: [
    char("b1", "반아소울", "소울이터", "딜러", 1760), char("b2", "반아유산", "스카우터", "딜러", 1750),
    char("b3", "반아대현", "데빌헌터", "딜러", 1745), char("b4", "반아블래", "블래스터", "딜러", 1740),
  ]},
];

const initialCatalog = [
  { id: "fourth-act-normal", name: "4막", difficulty: "노말", minLevel: 1700, gold: 27000, size: 8, color: "gray" },
  { id: "fourth-act-hard", name: "4막", difficulty: "하드", minLevel: 1720, gold: 38000, size: 8, color: "gray" },
  { id: "jongmak-normal", name: "종막", difficulty: "노말", minLevel: 1710, gold: 32000, size: 8, color: "gray" },
  { id: "jongmak-hard", name: "종막", difficulty: "하드", minLevel: 1730, gold: 48000, size: 8, color: "gray" },
  { id: "serka-normal", name: "세르카", difficulty: "노말", minLevel: 1710, gold: 32000, size: 4, color: "blue" },
  { id: "serka-hard", name: "세르카", difficulty: "하드", minLevel: 1730, gold: 44000, size: 4, color: "blue" },
  { id: "serka-nightmare", name: "세르카", difficulty: "나메", minLevel: 1740, gold: 54000, size: 4, color: "blue" },
  { id: "sungsimdang-1", name: "성심당", difficulty: "1단계", minLevel: 1700, gold: 30000, size: 4, color: "yellow" },
  { id: "sungsimdang-2", name: "성심당", difficulty: "2단계", minLevel: 1720, gold: 40000, size: 4, color: "yellow" },
  { id: "sungsimdang-3", name: "성심당", difficulty: "3단계", minLevel: 1750, gold: 50000, size: 4, color: "gold" },
  { id: "belgarden-normal", name: "벨가르딘", difficulty: "노말", minLevel: 1750, gold: 50000, size: 8, color: "purple" },
  { id: "belgarden-hard", name: "벨가르딘", difficulty: "하드", minLevel: 1770, gold: 62000, size: 8, color: "purple" },
  { id: "belgarden-nightmare", name: "벨가르딘", difficulty: "나메", minLevel: 1780, gold: 75000, size: 8, color: "purple" },
];

const initialSchedule = {
  wed: [
    { id: 101, catalogId: "jongmak-hard", characterIds: ["m2", "j1", "k1", "n1", "s1", "a1", "b1", "h1"] },
    { id: 102, catalogId: "serka-nightmare", characterIds: ["s2", "j3", "a5", "k3"] },
    { id: 103, catalogId: "sungsimdang-3", characterIds: ["m3", "h3", "n2", "b2"] },
  ],
  thu: [
    { id: 201, catalogId: "belgarden-normal", characterIds: ["s1", "a5", "k1", "j1", "m2", "h1", "n1", "b1"] },
    { id: 202, catalogId: "serka-hard", characterIds: ["h2", "s3", "a1", "k4"] },
    { id: 203, catalogId: "sungsimdang-3", characterIds: ["s2", "h3", "a5", "k3"] },
  ],
  fri: [
    { id: 301, catalogId: "belgarden-hard", characterIds: ["s1", "n2", "k1", "j1", "m3", "h3", "a5", "b1"] },
    { id: 302, catalogId: "serka-nightmare", characterIds: ["a2", "j3", "h1", "k3"] },
  ],
  sat: [
    { id: 401, catalogId: "belgarden-hard", characterIds: ["s1", "a5", "k1", "j1", "m2", "n2", "h3", "b1"] },
    { id: 402, catalogId: "sungsimdang-2", characterIds: ["m3", "n1", "s4", "a1"] },
  ],
  sun: [
    { id: 501, catalogId: "belgarden-normal", characterIds: ["s2", "j2", "k1", "h3", "m2", "a5", "n2", "b1"] },
    { id: 502, catalogId: "serka-nightmare", characterIds: ["a2", "h1", "s3", "b2"] },
  ],
  mon: [
    { id: 601, catalogId: "belgarden-hard", characterIds: ["j5", "a5", "h3", "s4", "m2", "k1", "n2", "b1"] },
    { id: 602, catalogId: "serka-nightmare", characterIds: ["s2", "a5", "j3", "h1"] },
  ],
  tue: [
    { id: 701, catalogId: "serka-hard", characterIds: ["h2", "j3", "m4", "k4"] },
    { id: 702, catalogId: "sungsimdang-3", characterIds: ["a2", "j3", "b1", "k3"] },
  ],
};

const formatNumber = (value) => new Intl.NumberFormat("ko-KR").format(value);

function flattenCharacters(members) {
  return members.flatMap((member, index) => member.characters.map((character) => ({
    ...character,
    memberId: member.id,
    memberName: member.name,
    unavailable: member.unavailable,
    color: member.color ?? palette[index % palette.length],
  })));
}

function AppHeader({ activeTab, setActiveTab }) {
  const tabs = [["schedule", "주간 일정"], ["personal", "개인 일정"], ["members", "멤버 관리"], ["raids", "레이드 관리"]];
  return <header className="app-header"><div><p className="eyebrow">LOA RAID BOARD</p><h1>길드 고정공대 일정표</h1></div><nav aria-label="주요 메뉴">{tabs.map(([id, label]) => <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>)}</nav></header>;
}

function StatusBadge({ character, day, raid }) {
  const unavailable = character.unavailable.includes(day);
  const levelShort = character.itemLevel < raid.minLevel;
  if (!unavailable && !levelShort) return null;
  const label = unavailable ? "불참" : "레벨 미달";
  const reason = unavailable ? `${character.memberName} 불가 요일` : `레벨 ${raid.minLevel} 미달`;
  return <span className={`warning ${unavailable ? "absent" : "level-short"}`} title={reason}>{label}</span>;
}

function RaidCard({ instance, catalog, roster, day, weekDays, conflictMap, isDragging, canMoveUp, canMoveDown, onSlotClick, onCatalogChange, onTimeChange, onMoveDay, onDragStart, onDragEnd, onDrop, onMoveUp, onMoveDown, canDelete, onDelete }) {
  const raid = catalog.find((item) => item.id === instance.catalogId);
  const raidVariants = sortRaidCatalog(catalog.filter((item) => item.name === raid.name));
  const slots = Array.from({ length: raid.size }, (_, index) => instance.characterIds[index] ?? null);
  const parties = raid.size === 8 ? [slots.slice(0, 4), slots.slice(4, 8)] : [slots];
  const conflictRows = [...new Map(slots.flatMap((characterId, slotIndex) => {
    const character = roster.find((item) => item.id === characterId);
    return (conflictMap.get(instance)?.get(slotIndex) ?? []).map((conflict) => [`${characterId}-${conflict.label}`, { characterName: character?.name ?? "캐릭터 정보 없음", ...conflict }]);
  })).values()];
  const onlyNoRewardConflicts = conflictRows.length > 0 && conflictRows.every((conflict) => conflict.label.includes("골드 없음"));
  return <article className={`raid-card ${isDragging ? "dragging" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <div className={`raid-title ${raid.color}`} style={{ background: getRaidColor(raid) }}><strong>{raid.name} {raid.difficulty}</strong><div className="raid-title-actions"><button type="button" disabled={!canMoveUp} onClick={onMoveUp} aria-label={`${raid.name} 위로 이동`}>↑</button><button type="button" disabled={!canMoveDown} onClick={onMoveDown} aria-label={`${raid.name} 아래로 이동`}>↓</button><span className="raid-drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} title="잡아서 위아래로 이동">↕ 드래그</span><span className="raid-size">{raid.size}인</span>{canDelete && <button type="button" className="delete-raid" onClick={onDelete}>삭제</button>}</div></div>
    <div className="raid-schedule-controls">{raidVariants.length > 1 && <label><span>난이도</span><select className="raid-variant-select" aria-label={`${raid.name} 난이도`} value={raid.id} onChange={(event) => onCatalogChange(event.target.value)}>{raidVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.difficulty} · Lv. {variant.minLevel}</option>)}</select></label>}<label><span>일정 위치</span><select aria-label={`${raid.name} ${raid.difficulty} 일정 위치`} value={day} onChange={(event) => onMoveDay(event.target.value)}>{weekDays.map((item) => <option key={item.key} value={item.key}>{item.key === "mobile" ? "모바출 (날짜 조율)" : `${item.label}요일 ${item.date}`}</option>)}</select></label><label><span>시작 시간</span><select className="raid-time-select" aria-label={`${raid.name} ${raid.difficulty} 시작 시간`} value={instance.startTime ?? defaultRaidTime} disabled={day === "mobile"} onChange={(event) => onTimeChange(event.target.value)}><option value="">시간 미정</option>{raidTimeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>{day === "mobile" && <small>날짜가 정해지면 요일을 선택하세요. 편성 인원은 그대로 유지됩니다.</small>}</div>
    <div className="requirement-row"><span>입장 레벨</span><strong>Lv. {raid.minLevel}</strong><span>획득 골드</span><strong>{formatNumber(raid.gold)}</strong></div>
    {parties.map((party, partyIndex) => <div className="party" key={partyIndex}>
      <div className="party-label">{raid.size === 8 ? `${partyIndex + 1}파티` : "파티"}</div>
      <div className="role-labels">{party.map((characterId, slotIndex) => {
        const character = roster.find((item) => item.id === characterId);
        return <span key={slotIndex}>{character && <ClassIcon className={character.className} size="role" />}{slotIndex === 0 ? "서폿" : "딜러"}</span>;
      })}</div>
      <div className="slots">{party.map((characterId, slotIndex) => {
        const absoluteSlot = partyIndex * 4 + slotIndex;
        const character = roster.find((item) => item.id === characterId);
        const conflicts = conflictMap.get(instance)?.get(absoluteSlot) ?? [];
        const conflictLabel = conflicts.map((conflict) => conflict.label).join(" · ");
        const conflictTitle = conflicts.map((conflict) => `${conflict.label}: ${conflict.details.join(" / ")}`).join("\n");
        const onlyNoReward = conflicts.length > 0 && conflicts.every((conflict) => conflict.label.includes("골드 없음"));
        const roleMismatch = character && ((slotIndex === 0 && character.role !== "서폿") || (slotIndex > 0 && character.role !== "딜러"));
        return <button key={absoluteSlot} className={`slot ${!characterId ? "empty" : ""} ${characterId && !character ? "missing-character" : ""} ${roleMismatch ? "role-mismatch" : ""}`} style={character ? { background: character.color } : undefined} onClick={() => onSlotClick(instance.id, absoluteSlot)}>
          <span>{character?.name ?? (characterId ? "캐릭터 정보 없음" : slotIndex === 0 ? "서폿 필요" : "딜러 필요")}</span>
          {character?.earnsGold === false && <span className="no-gold-badge">비골드</span>}
          {!!conflicts.length && <span className={`rule-conflict ${onlyNoReward ? "no-reward" : ""}`} title={conflictTitle}>{conflictLabel}</span>}
          {characterId && !character && !conflicts.length && <span className="warning level-short">정보 없음</span>}
          {character && <StatusBadge character={character} day={day} raid={raid} />}
        </button>;
      })}</div>
    </div>)}
    {conflictRows.length > 0 && <details className={`raid-conflict-details ${onlyNoRewardConflicts ? "no-reward" : ""}`}><summary>{onlyNoRewardConflicts ? "추가 참여" : "겹치는 일정"} {conflictRows.length}건 보기</summary>{conflictRows.map((conflict) => <div key={`${conflict.characterName}-${conflict.label}`}><b>{conflict.characterName} · {conflict.label}</b><span>{conflict.details.join(" / ")}</span></div>)}</details>}
  </article>;
}

function getCharacterAssignments(schedule, catalog, characterId, ignoredSlot = null, weekDays = getWeekDays(initialWeekStart)) {
  return Object.entries(schedule).flatMap(([dayKey, raids]) => raids.flatMap((instance) => instance.characterIds.flatMap((id, slotIndex) => {
    if (id !== characterId) return [];
    if (ignoredSlot && ignoredSlot.dayKey === dayKey && ignoredSlot.instanceId === instance.id && ignoredSlot.slotIndex === slotIndex) return [];
    const raid = catalog.find((item) => item.id === instance.catalogId);
    const day = weekDays.find((item) => item.key === dayKey);
    return [{ dayKey, instanceId: instance.id, slotIndex, catalogId: instance.catalogId, raidName: raid?.name ?? "레이드", difficulty: raid?.difficulty ?? "", startTime: instance.startTime ?? "", minLevel: raid?.minLevel ?? 0, gold: raid?.gold ?? 0, raidColor: raid ? getRaidColor(raid) : "#aaaaaa", label: `${day?.label ?? dayKey} ${instance.startTime || "시간 미정"} ${raid?.name ?? "레이드"} ${raid?.difficulty ?? ""}`.trim() }];
  })));
}

function getScheduleConflictMap(schedule, catalog, weekDays) {
  const assignmentsByCharacter = new Map();
  for (const [dayKey, raids] of Object.entries(schedule)) for (const instance of raids) {
    const raid = catalog.find((item) => item.id === instance.catalogId);
    instance.characterIds.forEach((characterId, slotIndex) => {
      if (!characterId) return;
      const day = weekDays.find((item) => item.key === dayKey);
      const dayLabel = dayKey === "mobile" ? "모바출" : `${day?.label ?? dayKey} ${day?.date ?? ""}`.trim();
      const assignment = { instance, slotIndex, raidName: raid?.name ?? "레이드", raidLevel: raid?.minLevel ?? 0, raidGold: raid?.gold ?? 0, detail: `${dayLabel} ${instance.startTime || "미정"} ${raid?.name ?? "레이드"} ${raid?.difficulty ?? ""}`.trim() };
      assignmentsByCharacter.set(characterId, [...(assignmentsByCharacter.get(characterId) ?? []), assignment]);
    });
  }
  const conflicts = new Map();
  const add = (assignment, label, details) => {
    const slots = conflicts.get(assignment.instance) ?? new Map();
    slots.set(assignment.slotIndex, [...(slots.get(assignment.slotIndex) ?? []), { label, details }]);
    conflicts.set(assignment.instance, slots);
  };
  for (const assignments of assignmentsByCharacter.values()) {
    if (assignments.length > 3) [...assignments]
      .sort((left, right) => left.raidLevel - right.raidLevel || left.raidGold - right.raidGold)
      .slice(0, assignments.length - 3)
      .forEach((assignment) => add(assignment, `주 ${assignments.length}회 · 이 레이드 골드 없음`, assignments.map((item) => item.detail)));
    const byRaidName = new Map();
    assignments.forEach((assignment) => byRaidName.set(assignment.raidName, [...(byRaidName.get(assignment.raidName) ?? []), assignment]));
    for (const [raidName, sameRaidAssignments] of byRaidName) if (sameRaidAssignments.length > 1) {
      sameRaidAssignments.forEach((assignment) => add(assignment, `${raidName} 중복`, sameRaidAssignments.map((item) => item.detail)));
    }
  }
  return conflicts;
}

function AssignmentModal({ members, roster, assignment, schedule, dayRaids, catalog, selectedDay, weekDays, onAssign, onClose }) {
  const raidInstance = dayRaids.find((item) => item.id === assignment.instanceId);
  const raid = catalog.find((item) => item.id === raidInstance.catalogId);
  const targetSlotIndex = Number(assignment.slotIndex);
  const targetRole = targetSlotIndex % 4 === 0 ? "서폿" : "딜러";
  const currentCharacter = roster.find((character) => character.id === raidInstance.characterIds[targetSlotIndex]);
  const occupiedMemberIds = new Set(raidInstance.characterIds
    .filter((_, index) => index !== targetSlotIndex)
    .map((id) => roster.find((character) => character.id === id)?.memberId)
    .filter(Boolean));
  const candidateGroups = members
    .filter((member) => member.active !== false && !occupiedMemberIds.has(member.id))
    .map((member) => ({ member, characters: member.characters
      .map((character) => ({ ...character, assignments: getCharacterAssignments(schedule, catalog, character.id, { dayKey: selectedDay, instanceId: assignment.instanceId, slotIndex: targetSlotIndex }, weekDays) }))
      .filter((character) => character.role === targetRole && character.itemLevel >= raid.minLevel && !character.assignments.some((item) => item.raidName === raid.name)) }))
    .filter((item) => item.characters.length);
  const priorityCandidates = candidateGroups.map(({ member, characters }) => ({ member, characters: characters.filter((character) => character.earnsGold !== false && character.assignments.length < 3) })).filter((item) => item.characters.length);
  const optionalCandidates = candidateGroups.map(({ member, characters }) => ({ member, characters: characters.filter((character) => character.earnsGold === false || character.assignments.length >= 3) })).filter((item) => item.characters.length);
  const currentMember = members.find((member) => member.id === currentCharacter?.memberId);
  const currentMemberHasCandidate = candidateGroups.some((item) => item.member.id === currentMember?.id);
  const blockedCurrentCharacters = currentMember?.characters.map((character) => {
    const assignments = getCharacterAssignments(schedule, catalog, character.id, { dayKey: selectedDay, instanceId: assignment.instanceId, slotIndex: targetSlotIndex }, weekDays);
    const reason = character.role !== targetRole ? `${character.role} 역할` : character.itemLevel < raid.minLevel ? `Lv. ${raid.minLevel} 미달` : assignments.some((item) => item.raidName === raid.name) ? `${raid.name} 이미 참여` : null;
    return { ...character, assignments, reason };
  }).filter((character) => character.reason) ?? [];
  const renderCandidateGroups = (groups, optional = false) => <div className={`roster-picker ${optional ? "optional" : "priority"}`}>{groups.map(({ member, characters }) => <section key={member.id}><div className="picker-member"><i style={{ background: member.color }} /><strong>{member.name}</strong><span>{characters.length}개 {targetRole}</span>{member.unavailable.includes(selectedDay) && <b>오늘 불가</b>}</div><div>{characters.map((character) => { const warning = member.unavailable.includes(selectedDay); return <button key={character.id} onClick={() => onAssign(character.id)}><ClassIcon className={character.className} /><strong>{character.name}{character.earnsGold === false ? " · 비골드 캐릭터" : optional ? " · 추가 참여" : ""}</strong><small>{character.className} · {character.role} · Lv. {character.itemLevel}<span className="raid-usage">주간 {character.assignments.length}/3{character.assignments.length ? ` · ${character.assignments.map((item) => item.label).join(", ")}` : " · 배정 없음"}</span>{optional && <span className="no-reward-notice">이 레이드에서는 골드를 받지 않습니다.</span>}</small><b className={warning ? "bad" : optional ? "no-reward" : "good"}>{warning ? "요일 확인" : optional ? "골드 없음" : "우선 선택"}</b></button>; })}</div></section>)}</div>;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal roster-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{targetRole} 슬롯 · 입장 레벨 이상 · 동일 레이드 주 1회</p><h3>{targetRole} 캐릭터 선택</h3></div><button onClick={onClose}>닫기</button></div><button className="remove-member" onClick={() => onAssign(null)}>빈자리로 두기</button>{currentMember && !currentMemberHasCandidate && <div className="same-member-blocked"><strong>{currentMember.name} 멤버의 교체 가능한 캐릭터가 없습니다.</strong><span>현재 칸은 같은 멤버로 교체할 수 있지만, 아래 조건에 걸린 캐릭터는 선택할 수 없습니다.</span><div>{blockedCurrentCharacters.map((character) => <p key={character.id}><b>{character.name}</b><em>{character.reason}</em></p>)}</div></div>}{!candidateGroups.length && <div className="api-error"><strong>선택 가능한 캐릭터가 없습니다.</strong><span>멤버 활성 상태, 역할, 입장 레벨과 동일 레이드 중복 여부를 확인해주세요.</span></div>}{priorityCandidates.length > 0 && <section className="candidate-tier"><div className="candidate-tier-heading"><strong>골드 획득 우선 캐릭터</strong><span>주간 3회 미만 · 먼저 배정 추천</span></div>{renderCandidateGroups(priorityCandidates)}</section>}{optionalCandidates.length > 0 && <section className="candidate-tier optional-tier"><div className="candidate-tier-heading"><strong>추가 참여 가능</strong><span>이미 3회 완료 또는 비골드 캐릭터 · 선택 가능</span></div>{renderCandidateGroups(optionalCandidates, true)}</section>}</section></div>;
}

function WeeklyAvailabilityModal({ members, weekDays, onToggleDay, onClose }) {
  const activeMembers = members.filter((member) => member.active !== false);
  const datedDays = weekDays.filter((day) => day.key !== "mobile");
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal availability-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{datedDays[0].date} ~ {datedDays.at(-1).date}</p><h3>이번 주 불참 설정</h3></div><button onClick={onClose}>닫기</button></div><p className="modal-description">이번 주에 참여할 수 없는 날짜만 선택하세요. 선택한 날짜에 배정된 캐릭터는 일정표에 빨간색 불참 표시가 나타납니다.</p><div className="availability-list">{activeMembers.map((member) => <article key={member.id}><div className="availability-member"><i style={{ background: member.color }} /><strong>{member.name}</strong><small>{member.unavailable.length ? `${member.unavailable.length}일 불참` : "전체 참여 가능"}</small></div><div className="availability-week">{datedDays.map((day) => <button key={day.key} className={member.unavailable.includes(day.key) ? "selected" : ""} onClick={() => onToggleDay(member.id, day.key)}><span>{day.label}</span><small>{day.date}</small></button>)}</div></article>)}</div></section></div>;
}

function WeeklyScheduleExport({ exportRef, schedule, catalog, members, weekDays, weekStart }) {
  const roster = flattenCharacters(members);
  const visibleDays = weekDays.filter((day) => (schedule[day.key] ?? []).length > 0);
  const estimateDayHeight = (day) => {
    const raids = schedule[day.key] ?? [];
    return 65 + raids.reduce((height, instance) => height + (catalog.find((raid) => raid.id === instance.catalogId)?.size === 8 ? 132 : 86), 0) + Math.max(0, raids.length - 1) * 10;
  };
  const estimatePageHeight = (days) => {
    let height = 0;
    for (let index = 0; index < days.length; index += 2) height += Math.max(estimateDayHeight(days[index]), days[index + 1] ? estimateDayHeight(days[index + 1]) : 0) + (index ? 15 : 0);
    return height;
  };
  const dayGroups = visibleDays.reduce((groups, day) => {
    const current = groups.at(-1);
    if (!current || estimatePageHeight([...current, day]) > 980) groups.push([day]);
    else current.push(day);
    return groups;
  }, []);
  if (dayGroups.length > 1 && dayGroups.at(-1).length === 1 && dayGroups.at(-2).length > 2) {
    dayGroups.at(-1).unshift(...dayGroups.at(-2).splice(-2));
  }
  const startDate = parseDateKey(weekStart);
  const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
  return <div className="weekly-export-stage" aria-hidden="true" ref={exportRef}>
    {dayGroups.map((visibleDays, pageIndex) => <section className="weekly-export-sheet" key={pageIndex}>
      <header className="weekly-export-header"><div><p>LOA RAID BOARD</p><h1>길드 고정공대 주간 일정</h1></div><div><span>{startDate.getFullYear()}년 {startDate.getMonth() + 1}월 {startDate.getDate()}일 ~ {endDate.getMonth() + 1}월 {endDate.getDate()}일</span><strong>{startDate.getMonth() + 1}월 {getCalendarWeekOfMonth(startDate)}주차</strong></div></header>
      <main>{visibleDays.map((day) => <section className={`weekly-export-day ${day.key === "mobile" ? "mobile" : ""}`} key={day.key}>
        <div className="weekly-export-day-title"><strong>{day.full}</strong><span>{day.key === "mobile" ? "날짜 조율" : day.date}</span></div>
        <div className="weekly-export-raids">{[...(schedule[day.key] ?? [])].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)).map((instance) => {
          const raid = catalog.find((item) => item.id === instance.catalogId);
          if (!raid) return null;
          const slots = Array.from({ length: raid.size }, (_, index) => instance.characterIds[index] ?? null);
          const parties = raid.size === 8 ? [slots.slice(0, 4), slots.slice(4, 8)] : [slots];
          return <article className="weekly-export-raid" key={instance.id}>
            <div className="weekly-export-raid-title" style={{ background: getRaidColor(raid) }}><strong>{raid.name} {raid.difficulty}</strong><span>{day.key === "mobile" ? "시간 조율" : instance.startTime || "시간 미정"} · {raid.size}인 · {formatNumber(raid.gold)} 골드</span></div>
            {parties.map((party, partyIndex) => <div className="weekly-export-party" key={partyIndex}>
              <b>{raid.size === 8 ? `${partyIndex + 1}파티` : "파티"}</b>
              <div>{party.map((characterId, slotIndex) => {
                const character = roster.find((item) => item.id === characterId);
                const isUnavailable = character?.unavailable.includes(day.key);
                return <span className={!character ? "empty" : ""} style={character ? { background: character.color } : undefined} key={slotIndex}><strong>{character?.name ?? (slotIndex === 0 ? "서폿 필요" : "딜러 필요")}</strong>{isUnavailable && <em>불참</em>}</span>;
              })}</div>
            </div>)}
          </article>;
        })}</div>
      </section>)}</main>
      <footer>길드 고정공대 일정표 · {pageIndex + 1}/{dayGroups.length} · 저장 시점 기준</footer>
    </section>)}
  </div>;
}

function ScheduleView({ members, catalog, schedule, setSchedule, weekDays, weekStart, canGoPrevious, canGoNext, canCopyNextWeek, onPreviousWeek, onCurrentWeek, onNextWeek, onCopyNextWeek, onToggleUnavailable }) {
  const roster = useMemo(() => flattenCharacters(members), [members]);
  const [selectedDay, setSelectedDay] = useState("wed");
  const [assignment, setAssignment] = useState(null);
  const [showAddRaid, setShowAddRaid] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [draggingRaidId, setDraggingRaidId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef(null);
  const [timeSortedViews, setTimeSortedViews] = useState(() => new Set());
  const dayInfo = weekDays.find((day) => day.key === selectedDay) ?? weekDays[0];
  const dayRaids = schedule[selectedDay] ?? [];
  const currentViewKey = `${weekStart}:${selectedDay}`;
  const isTimeSorted = timeSortedViews.has(currentViewKey);
  const displayDayRaids = useMemo(() => [...dayRaids].sort(isTimeSorted
    ? (left, right) => raidTimeSortValue(left.startTime) - raidTimeSortValue(right.startTime) || (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
    : (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)), [dayRaids, isTimeSorted]);
  const conflictMap = useMemo(() => getScheduleConflictMap(schedule, catalog, weekDays), [schedule, catalog, weekDays]);
  const extraParticipants = useMemo(() => roster.flatMap((character) => {
    const assignments = getCharacterAssignments(schedule, catalog, character.id, null, weekDays);
    if (assignments.length <= 3) return [];
    const noRewardAssignments = [...assignments].sort((left, right) => left.minLevel - right.minLevel || left.gold - right.gold).slice(0, assignments.length - 3);
    return [{ character, count: assignments.length, noRewardAssignments }];
  }), [roster, schedule, catalog, weekDays]);

  const assignCharacter = (characterId) => {
    if (characterId) {
      const raidInstance = dayRaids.find((raid) => raid.id === assignment.instanceId);
      const candidate = roster.find((character) => character.id === characterId);
      const targetSlotIndex = Number(assignment.slotIndex);
      const targetRole = targetSlotIndex % 4 === 0 ? "서폿" : "딜러";
      const duplicateMember = raidInstance.characterIds.some((id, index) => index !== targetSlotIndex && roster.find((character) => character.id === id)?.memberId === candidate?.memberId);
      const raid = catalog.find((item) => item.id === raidInstance.catalogId);
      const weeklyAssignments = getCharacterAssignments(schedule, catalog, characterId, { dayKey: selectedDay, instanceId: assignment.instanceId, slotIndex: targetSlotIndex }, weekDays);
      const duplicateRaid = weeklyAssignments.some((item) => item.raidName === raid.name);
      if (!candidate || candidate.role !== targetRole || candidate.itemLevel < raid.minLevel || duplicateMember || duplicateRaid) return;
    }
    setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((raid) => raid.id === assignment.instanceId
      ? { ...raid, characterIds: Array.from({ length: catalog.find((item) => item.id === raid.catalogId).size }, (_, index) => index === assignment.slotIndex ? characterId : raid.characterIds[index] ?? null) }
      : raid) }));
    setAssignment(null);
  };
  const withOrder = (items) => items.map((item, index) => ({ ...item, order: index }));
  const addRaid = (catalogId) => { setSchedule((current) => ({ ...current, [selectedDay]: [...(current[selectedDay] ?? []), { id: Date.now(), catalogId, characterIds: [], startTime: selectedDay === "mobile" ? "" : defaultRaidTime, order: current[selectedDay]?.length ?? 0 }] })); setShowAddRaid(false); };
  const deleteRaid = (raidId) => setSchedule((current) => ({ ...current, [selectedDay]: withOrder(removeScheduledRaid(current[selectedDay] ?? [], raidId)) }));
  const changeRaidCatalog = (instanceId, catalogId) => setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((instance) => {
    if (instance.id !== instanceId) return instance;
    const nextRaid = catalog.find((raid) => raid.id === catalogId);
    return { ...instance, catalogId, characterIds: Array.from({ length: nextRaid.size }, (_, index) => instance.characterIds[index] ?? null) };
  }) }));
  const changeRaidTime = (instanceId, startTime) => setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((instance) => instance.id === instanceId ? { ...instance, startTime } : instance) }));
  const reorderRaid = (sourceId, targetId) => {
    if (sourceId === null || sourceId === targetId) return;
    setSchedule((current) => {
      const items = [...(current[selectedDay] ?? [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moving] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moving);
      return { ...current, [selectedDay]: withOrder(items) };
    });
  };
  const moveRaidBy = (instanceId, amount) => {
    const index = displayDayRaids.findIndex((item) => item.id === instanceId);
    const target = displayDayRaids[index + amount];
    if (target) reorderRaid(instanceId, target.id);
  };
  const toggleTimeSortedView = () => setTimeSortedViews((current) => {
    const next = new Set(current);
    if (next.has(currentViewKey)) next.delete(currentViewKey);
    else next.add(currentViewKey);
    return next;
  });
  const downloadWeeklyImage = async () => {
    if (!exportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await document.fonts?.ready;
      const sheets = [...exportRef.current.querySelectorAll(".weekly-export-sheet")];
      for (let index = 0; index < sheets.length; index += 1) {
        const canvas = await html2canvas(sheets[index], { backgroundColor: "#f3f5f0", scale: 2, useCORS: true, logging: false });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("이미지를 만들 수 없습니다.");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `로아_공대일정_${weekStart}_${index + 1}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (error) {
      window.alert(`이미지 저장 실패: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  const moveRaid = (instanceId, targetDay) => {
    if (targetDay === selectedDay) return;
    setSchedule((current) => {
      const moving = current[selectedDay].find((instance) => instance.id === instanceId);
      if (!moving) return current;
      const moved = targetDay === "mobile" ? { ...moving, startTime: "" } : moving;
      return { ...current, [selectedDay]: withOrder(current[selectedDay].filter((instance) => instance.id !== instanceId)), [targetDay]: withOrder([...(current[targetDay] ?? []), moved]) };
    });
    setSelectedDay(targetDay);
  };
  const warningCount = useMemo(() => dayRaids.reduce((count, instance) => {
    const raid = catalog.find((item) => item.id === instance.catalogId);
    return count + instance.characterIds.filter((id, slotIndex) => { const character = roster.find((item) => item.id === id); return id && (!character || character.unavailable.includes(selectedDay) || character.itemLevel < raid.minLevel || conflictMap.get(instance)?.has(slotIndex)); }).length;
  }, 0), [dayRaids, catalog, roster, selectedDay, conflictMap]);

  const startDate = parseDateKey(weekStart);
  const endDate = parseDateKey(shiftWeekKey(weekStart, 1)); endDate.setDate(endDate.getDate() - 1);
  return <>
    <section className="week-toolbar"><div className="week-navigation"><button className="text-button" onClick={onPreviousWeek} disabled={!canGoPrevious}>이전 주</button><button className="current-week-button" onClick={onCurrentWeek} disabled={weekStart === currentWeekStart}>현재 주</button><button className="text-button" onClick={onNextWeek} disabled={!canGoNext}>다음 주</button></div><div className="week-label"><span>{startDate.getFullYear()}년 {startDate.getMonth() + 1}월 {startDate.getDate()}일 ~ {endDate.getMonth() + 1}월 {endDate.getDate()}일</span><strong>{startDate.getMonth() + 1}월 {getCalendarWeekOfMonth(startDate)}주차</strong></div><div className="week-actions"><button className="export-week" onClick={downloadWeeklyImage} disabled={isExporting} title="일정량에 맞춰 여러 장으로 자동 분할합니다.">{isExporting ? "이미지 만드는 중" : "일정 이미지 저장"}</button><button className="copy-week" onClick={onCopyNextWeek} disabled={!canCopyNextWeek} title={canGoNext && !canCopyNextWeek ? "현재 주에 복사할 일정이 없습니다." : "다음 주 일정으로 전체 복사"}>{canGoNext && !canCopyNextWeek ? "복사 일정 없음" : "다음 주 복사"}</button></div></section>
    <section className="day-tabs" aria-label="요일 선택">{weekDays.map((day) => <button key={day.key} className={`${selectedDay === day.key ? "active" : ""} ${day.key === "sun" ? "sunday" : ""} ${day.key === "mobile" ? "mobile-call" : ""}`} onClick={() => setSelectedDay(day.key)}><span>{day.label}</span><strong>{day.date}</strong><small>{schedule[day.key]?.length ?? 0}개</small></button>)}</section>
    {extraParticipants.length > 0 && <section className="weekly-extra-participants"><div><strong>추가 참여 캐릭터</strong><span>3회 초과 레이드는 입장 가능하지만 골드를 받지 않습니다.</span></div><div>{extraParticipants.map(({ character, count, noRewardAssignments }) => <article key={character.id} style={{ borderLeftColor: character.color }}><strong>{character.name}</strong><b>{count}/3</b><span>{noRewardAssignments.map((assignment) => `${assignment.raidName} ${assignment.difficulty}`).join(" · ")} 골드 없음</span></article>)}</div></section>}
    <div className="content-grid"><main className="schedule-panel"><div className="section-heading"><div><p>{dayInfo.date}</p><h2>{dayInfo.full} 공대 일정</h2></div><div className="heading-actions"><button className="text-button" onClick={toggleTimeSortedView}>{isTimeSorted ? "직접순 보기" : "시간순 보기"}</button><button className="text-button" onClick={() => setShowAvailability(true)}>이번 주 불참 설정</button><button className="primary" onClick={() => setShowAddRaid(true)}>+ 레이드 추가</button></div></div>{displayDayRaids.length ? displayDayRaids.map((instance, index) => <RaidCard key={instance.id} instance={instance} catalog={catalog} roster={roster} day={selectedDay} weekDays={weekDays} conflictMap={conflictMap} isDragging={draggingRaidId === instance.id} canMoveUp={index > 0} canMoveDown={index < displayDayRaids.length - 1} onSlotClick={(instanceId, slotIndex) => setAssignment({ instanceId, slotIndex })} onCatalogChange={(catalogId) => changeRaidCatalog(instance.id, catalogId)} onTimeChange={(startTime) => changeRaidTime(instance.id, startTime)} onMoveDay={(targetDay) => moveRaid(instance.id, targetDay)} onDragStart={(event) => { setDraggingRaidId(instance.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(instance.id)); }} onDragEnd={() => setDraggingRaidId(null)} onDrop={(event) => { event.preventDefault(); const sourceId = draggingRaidId ?? Number(event.dataTransfer.getData("text/plain")); reorderRaid(sourceId, instance.id); setDraggingRaidId(null); }} onMoveUp={() => moveRaidBy(instance.id, -1)} onMoveDown={() => moveRaidBy(instance.id, 1)} canDelete={canDeleteScheduledRaid(instance)} onDelete={() => deleteRaid(instance.id)} />) : <div className="empty-schedule"><strong>{dayInfo.full} 일정이 없습니다.</strong><span>{selectedDay === "mobile" ? "날짜를 조율할 공대를 이곳에 추가하세요." : "레이드를 추가하거나 다른 날짜의 공대를 이 날짜로 이동하세요."}</span></div>}</main>
      <aside className="summary-panel"><p className="summary-title">오늘의 편성 상태</p><div className="summary-number"><strong>{dayRaids.length}</strong><span>개 레이드</span></div><div className={`notice ${warningCount ? "has-warning" : ""}`}><strong>{warningCount ? `${warningCount}개 슬롯 확인 필요` : "편성 이상 없음"}</strong><p>{warningCount ? "불참·레벨 미달·추가 참여(골드 없음)·동일 레이드 중복을 확인해주세요." : "모든 캐릭터가 참가 조건을 만족합니다."}</p></div><div className="legend"><span><i className="dot red" />불참/레벨/중복</span><span><i className="dot orange" />추가 참여</span><span><i className="dot outline" />빈자리</span></div></aside>
    </div>
    {assignment && <AssignmentModal members={members} roster={roster} assignment={assignment} schedule={schedule} dayRaids={dayRaids} catalog={catalog} selectedDay={selectedDay} weekDays={weekDays} onAssign={assignCharacter} onClose={() => setAssignment(null)} />}
    {showAvailability && <WeeklyAvailabilityModal members={members} weekDays={weekDays} onToggleDay={onToggleUnavailable} onClose={() => setShowAvailability(false)} />}
    {showAddRaid && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAddRaid(false)}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{dayInfo.full} 일정</p><h3>레이드 추가</h3></div><button onClick={() => setShowAddRaid(false)}>닫기</button></div><div className="catalog-picker">{catalog.map((raid) => <button key={raid.id} onClick={() => addRaid(raid.id)}><span className={`catalog-color ${raid.color}`} style={{ background: getRaidColor(raid) }} /><span><strong>{raid.name} {raid.difficulty}</strong><small>{raid.size}인 · Lv. {raid.minLevel} · {formatNumber(raid.gold)} 골드</small></span></button>)}</div></section></div>}
    <WeeklyScheduleExport exportRef={exportRef} schedule={schedule} catalog={catalog} members={members} weekDays={weekDays} weekStart={weekStart} />
  </>;
}

function RosterSyncModal({ member, members, isNew, onMemberChange, onClose, onSave }) {
  const [characterName, setCharacterName] = useState(member.characters[0]?.name ?? member.representativeName ?? "");
  const [newMemberName, setNewMemberName] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  useEffect(() => {
    setCharacterName(member.characters[0]?.name ?? member.representativeName ?? "");
    setNewMemberName("");
    setStatus("idle"); setMessage(""); setCharacters([]); setSelectedIds([]);
  }, [member.id]);
  const search = async (event) => {
    event.preventDefault(); setStatus("loading"); setMessage("");
    try {
      const response = await fetch(`/api/lostark/roster?characterName=${encodeURIComponent(characterName)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "조회에 실패했습니다.");
      setCharacters(body.characters); setSelectedIds(body.characters.map((character) => character.id)); setStatus("success");
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };
  const toggleCharacter = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const saveSelected = () => {
    const existingByName = new Map(member.characters.map((character) => [character.name, character]));
    const missing = onSave(characters.filter((character) => selectedIds.includes(character.id)).map((character, index) => ({
      ...character,
      id: existingByName.get(character.name)?.id ?? character.id,
      role: existingByName.get(character.name)?.role ?? character.role,
      earnsGold: existingByName.get(character.name)?.earnsGold ?? index < 6,
    })), newMemberName.trim());
    if (missing?.length) setMessage(`일정에 사용 중인 ${missing.join(", ")} 캐릭터도 선택해주세요.`);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal sync-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{isNew ? "신규 멤버" : `${member.name} 멤버`}</p><h3>원정대 캐릭터 조회</h3></div><button onClick={onClose}>닫기</button></div><label className="sync-member-select">저장할 멤버<select value={isNew ? "__new__" : member.id} onChange={(event) => onMemberChange(event.target.value)}><option value="__new__">+ 신규 멤버 추가</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{isNew && <label className="sync-member-select">새 멤버 별명<input value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="예: 새 공대원" /></label>}<p className="modal-description">대표 캐릭터명 하나로 같은 원정대를 조회하고, 일정에 사용할 캐릭터를 저장합니다. 처음 6캐릭은 골드 획득으로 설정되며 멤버 관리에서 바꿀 수 있습니다.</p><form className="lookup-form" onSubmit={search}><label>대표 캐릭터명<input required value={characterName} onChange={(event) => setCharacterName(event.target.value)} /></label><button className="primary" disabled={status === "loading"}>{status === "loading" ? "조회 중" : "API 조회"}</button></form>{message && <div className="api-error"><strong>{status === "error" ? "연결 확인 필요" : "일정 캐릭터 확인 필요"}</strong><span>{message}</span></div>}{status === "success" && <><div className="selection-count"><strong>{selectedIds.length}개 선택</strong><span>캐릭터 수 제한 없이 일정에 사용할 캐릭터만 선택하세요.</span></div><div className="sync-result">{characters.map((character) => <button type="button" className={selectedIds.includes(character.id) ? "selected" : ""} aria-pressed={selectedIds.includes(character.id)} key={character.id} onClick={() => toggleCharacter(character.id)}><strong>{character.name}</strong><span>{character.className} · Lv. {character.itemLevel}</span><b>{character.role}</b></button>)}</div><button className="primary full" disabled={!selectedIds.length || (isNew && !newMemberName.trim())} onClick={saveSelected}>선택한 {selectedIds.length}개 캐릭터 저장</button></>}</section></div>;
}

function MemberAliasEditor({ member, onRename }) {
  const [value, setValue] = useState(member.name);
  const commit = () => {
    const nextName = value.trim();
    if (!nextName) { setValue(member.name); return; }
    if (nextName !== member.name) onRename(nextName);
  };
  const goldCharacterCount = member.characters.filter((character) => character.earnsGold !== false).length;
  return <div className="member-alias-editor"><label htmlFor={`alias-${member.id}`}>멤버 별명</label><div><input id={`alias-${member.id}`} value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>{member.characters.length}캐릭 · 골드 {goldCharacterCount}/6</span></div></div>;
}

function GuildImportModal({ onClose, onImport }) {
  const [guildName, setGuildName] = useState("지금이야");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);
  const loadGuild = async (event) => {
    event?.preventDefault(); setStatus("loading"); setMessage(""); setSelectedNames([]);
    try {
      const response = await fetch(`/api/kloa/guild?guildName=${encodeURIComponent(guildName)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "길드 조회에 실패했습니다.");
      setCharacters(body.characters); setStatus("success");
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };
  useEffect(() => { loadGuild(); }, []);
  const filtered = useMemo(() => characters.filter((character) => character.name.toLocaleLowerCase("ko").includes(query.trim().toLocaleLowerCase("ko"))), [characters, query]);
  const toggle = (name) => setSelectedNames((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal guild-import-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>공대 멤버 초기 설정</p><h3>길드 캐릭터에서 대표 캐릭터 선택</h3></div><button onClick={onClose}>닫기</button></div><p className="modal-description">실제 사람마다 대표 캐릭터를 하나씩 선택하세요. 완료하면 현재 예시 멤버를 교체하고, 공식 API로 각 원정대의 최대 6캐릭터를 저장할 수 있습니다.</p><form className="guild-lookup-form" onSubmit={loadGuild}><label>길드명<input required value={guildName} onChange={(event) => setGuildName(event.target.value)} /></label><button className="primary" disabled={status === "loading"}>{status === "loading" ? "불러오는 중" : "길드 조회"}</button></form>{status === "error" && <div className="api-error"><strong>길드 연결 확인 필요</strong><span>{message}</span></div>}{status === "success" && <><div className="guild-filter"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${characters.length}개 캐릭터에서 이름 검색`} /><strong>{selectedNames.length}명 선택</strong></div><div className="guild-character-list">{filtered.map((character) => <button type="button" key={character.name} className={selectedNames.includes(character.name) ? "selected" : ""} aria-pressed={selectedNames.includes(character.name)} onClick={() => toggle(character.name)}><span><strong>{character.name}</strong>{character.isOwner && <em>길드장</em>}</span><b>Lv. {character.itemLevel}</b></button>)}</div><button className="primary full" disabled={!selectedNames.length} onClick={() => onImport(characters.filter((character) => selectedNames.includes(character.name)))}>선택한 {selectedNames.length}명으로 초기 설정</button></>}</section></div>;
}

function CharacterAssignmentSummary({ assignments, weekDays }) {
  const raidCounts = assignments.reduce((counts, assignment) => ({ ...counts, [assignment.raidName]: (counts[assignment.raidName] ?? 0) + 1 }), {});
  return <div className="member-character-usage">
    <div className={`member-character-count ${assignments.length >= 3 ? "full" : ""} ${assignments.length > 3 ? "over" : ""}`}><small>주간</small><strong>{assignments.length}/3</strong>{assignments.length > 3 && <em>+{assignments.length - 3} 비골드</em>}</div>
    <div className="member-assignment-chips">{assignments.length
      ? assignments.map((item) => <span className={`member-assignment-chip ${raidCounts[item.raidName] > 1 ? "duplicate" : ""}`} key={`${item.dayKey}-${item.instanceId}-${item.slotIndex}`}><b>{weekDays.find((day) => day.key === item.dayKey)?.label}</b><em>{item.startTime || "미정"}</em>{item.raidName} {item.difficulty}{raidCounts[item.raidName] > 1 && <strong>중복</strong>}</span>)
      : <span className="member-assignment-empty">배정된 레이드 없음</span>}
    </div>
  </div>;
}

function MemberRosterCard({ member, schedule, catalog, weekDays, onRename, onColorChange, onToggleActive, onToggleRole, onToggleGold }) {
  const collapsedStorageKey = "loa-member-roster-collapsed-v1";
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(collapsedStorageKey) ?? "{}")[member.id] === true; }
    catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((current) => {
    const next = !current;
    try {
      const saved = JSON.parse(localStorage.getItem(collapsedStorageKey) ?? "{}");
      localStorage.setItem(collapsedStorageKey, JSON.stringify({ ...saved, [member.id]: next }));
    } catch { /* 브라우저 저장소를 사용할 수 없으면 현재 화면에서만 유지합니다. */ }
    return next;
  });
  return <article className={`member-roster-card ${member.active === false ? "inactive" : ""} ${collapsed ? "collapsed" : ""}`}>
    <div className="member-roster-head">
      <label className="member-color-picker" title="멤버 색상 변경" aria-label={`${member.name} 멤버 색상`}>
        <input type="color" value={member.color} onChange={(event) => onColorChange(event.target.value)} />
        <i style={{ background: member.color }} />
      </label>
      <MemberAliasEditor member={member} onRename={onRename} />
      <div className="unavailable-days"><small>이번 주 불참</small><strong>{member.unavailable.length ? member.unavailable.map((dayKey) => weekDays.find((day) => day.key === dayKey)?.date).join(" · ") : "없음"}</strong></div>
      <div className="member-actions"><button className={member.active === false ? "excluded" : "included"} onClick={onToggleActive}>{member.active === false ? "레이드 제외됨" : "레이드 참여"}</button></div>
      <button type="button" className="member-fold-toggle" aria-expanded={!collapsed} onClick={toggleCollapsed}>{collapsed ? "펼치기 ▼" : "접기 ▲"}</button>
    </div>
    {!collapsed && <div className="character-grid">{member.characters.map((character) => {
      const assignments = getCharacterAssignments(schedule, catalog, character.id, null, weekDays);
      return <section key={character.id} className={character.earnsGold === false ? "no-gold" : ""}><div className="character-identity"><ClassIcon className={character.className} /><div><strong>{character.name}</strong><span>{character.className}</span></div></div><div className="character-power"><b>Lv. {character.itemLevel}</b>{character.combatPower != null && <small>전투력 {formatNumber(character.combatPower)}</small>}</div><div className="character-badges"><button className={character.role === "서폿" ? "support" : "dealer"} disabled={character.className !== "발키리"} title={character.className === "발키리" ? "딜러/서폿 전환" : "직업 고정 역할"} onClick={() => onToggleRole(character.id)}>{character.role}</button><button className={`gold-toggle ${character.earnsGold === false ? "off" : "on"}`} title="이 캐릭터의 레이드 골드 획득 여부" onClick={() => onToggleGold(character.id)}>{character.earnsGold === false ? "비골드" : "골드"}</button></div><CharacterAssignmentSummary assignments={assignments} weekDays={weekDays} /></section>;
    })}</div>}
  </article>;
}

function MembersView({ members, setMembers, schedule, setSchedule, catalog, weekDays }) {
  const [syncMemberId, setSyncMemberId] = useState(null);
  const [bulkRefreshStatus, setBulkRefreshStatus] = useState("");
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const toggleRole = (memberId, characterId) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, characters: member.characters.map((character) => character.id === characterId && character.className === "발키리" ? { ...character, role: character.role === "서폿" ? "딜러" : "서폿" } : character) } : member));
  const toggleGold = (memberId, characterId) => setMembers((current) => current.map((member) => {
    if (member.id !== memberId) return member;
    const target = member.characters.find((character) => character.id === characterId);
    const goldCount = member.characters.filter((character) => character.earnsGold !== false).length;
    if (target?.earnsGold === false && goldCount >= 6) return member;
    return { ...member, characters: member.characters.map((character) => character.id === characterId ? { ...character, earnsGold: character.earnsGold === false } : character) };
  }));
  const toggleActive = (memberId) => setMembers((current) => current
    .map((member) => member.id === memberId ? { ...member, active: member.active === false } : member)
    .sort((left, right) => Number(left.active === false) - Number(right.active === false)));
  const renameMember = (memberId, name) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, name } : member));
  const changeMemberColor = (memberId, color) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, color } : member));
  const saveRoster = (characters, newMemberName = "") => {
    if (syncMemberId === "__new__") {
      setMembers((current) => [...current, { id: `member-${Date.now()}`, name: newMemberName, representativeName: characters[0]?.name ?? "", color: palette[current.length % palette.length], active: true, unavailable: [], characters }]);
      setSyncMemberId(null);
      return [];
    }
    const member = members.find((item) => item.id === syncMemberId);
    const migration = migrateRosterSchedule({ previousCharacters: member.characters, refreshedCharacters: characters, schedule });
    if (migration.missingAssignedNames.length) return migration.missingAssignedNames;
    setMembers((current) => current.map((item) => item.id === syncMemberId ? { ...item, characters } : item));
    setSchedule(migration.schedule);
    setSyncMemberId(null);
    return [];
  };
  const activeMembers = members.filter((member) => member.active !== false);
  const inactiveMembers = members.filter((member) => member.active === false);
  const syncingMember = syncMemberId === "__new__" ? { id: "__new__", name: "신규 멤버", characters: [] } : members.find((member) => member.id === syncMemberId);
  const refreshScheduledMembers = async () => {
    const scheduledCharacterIds = new Set(Object.values(schedule).flatMap((instances) => instances.flatMap((instance) => instance.characterIds.filter(Boolean))));
    const targets = members.flatMap((member) => member.characters).filter((character) => scheduledCharacterIds.has(character.id));
    if (!targets.length) { setBulkRefreshStatus("현재 일정에 등록된 캐릭터가 없습니다."); return; }
    setBulkRefreshing(true); setBulkRefreshStatus(`${targets.length}캐릭터 레벨·전투력 갱신 중`);
    const results = await Promise.all(targets.map(async (character) => {
      try {
        const response = await fetch(`/api/lostark/profile?characterName=${encodeURIComponent(character.name)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "조회 실패");
        return { id: character.id, itemLevel: body.itemLevel, combatPower: body.combatPower };
      } catch { return { id: character.id, failed: true, name: character.name }; }
    }));
    const refreshedById = new Map(results.filter((result) => !result.failed).map((result) => [result.id, result]));
    const failed = results.filter((result) => result.failed).map((result) => result.name);
    setMembers((current) => current.map((member) => ({ ...member, characters: member.characters.map((character) => refreshedById.has(character.id) ? { ...character, itemLevel: refreshedById.get(character.id).itemLevel, combatPower: refreshedById.get(character.id).combatPower } : character) })));
    setBulkRefreshing(false);
    setBulkRefreshStatus(failed.length ? `${targets.length - failed.length}캐릭터 갱신 · 실패: ${failed.join(", ")}` : `${targets.length}캐릭터 갱신 완료 · 저장 버튼을 눌러 확정하세요.`);
  };
  const renderMember = (member) => <MemberRosterCard key={member.id} member={member} schedule={schedule} catalog={catalog} weekDays={weekDays} onRename={(name) => renameMember(member.id, name)} onColorChange={(color) => changeMemberColor(member.id, color)} onToggleActive={() => toggleActive(member.id)} onToggleRole={(characterId) => toggleRole(member.id, characterId)} onToggleGold={(characterId) => toggleGold(member.id, characterId)} />;
  const openRosterSync = () => setSyncMemberId(activeMembers[0]?.id ?? members[0]?.id ?? "__new__");
  const changeSyncMember = (memberId) => setSyncMemberId(memberId === "__new__" ? "__new__" : members.find((member) => String(member.id) === String(memberId))?.id ?? null);
  return <section className="management-page"><div className="section-heading"><div><p>멤버 {activeMembers.length}명 활성 · 전체 {members.length}명</p><h2>멤버별 원정대 캐릭터</h2></div><div className="heading-actions"><button className="text-button" onClick={() => setSyncMemberId("__new__")}>+ 신규 멤버</button><button className="text-button" disabled={bulkRefreshing} onClick={refreshScheduledMembers}>{bulkRefreshing ? "정보 갱신 중" : "일정 캐릭터 정보 갱신"}</button><button className="primary" onClick={openRosterSync}>기존 멤버 조회</button></div></div><div className="info-banner"><strong>고정 색상과 레이드 참여 상태 관리</strong><span>이번 주 불참 요일은 주간 일정의 ‘이번 주 불참 설정’에서 변경합니다.</span></div>{bulkRefreshStatus && <div className="bulk-refresh-status">{bulkRefreshStatus}</div>}<div className="member-roster-list">{activeMembers.map(renderMember)}</div>{inactiveMembers.length > 0 && <details className="excluded-members"><summary>레이드 제외 멤버 {inactiveMembers.length}명</summary><div className="member-roster-list">{inactiveMembers.map(renderMember)}</div></details>}{syncingMember && <RosterSyncModal member={syncingMember} members={members} isNew={syncMemberId === "__new__"} onMemberChange={changeSyncMember} onClose={() => setSyncMemberId(null)} onSave={saveRoster} />}</section>;
}

function PersonalScheduleView({ members, schedule, catalog, weekDays, weekStart }) {
  const availableMembers = members.filter((member) => member.active !== false);
  const [myMemberId, setMyMemberId] = useState(() => localStorage.getItem("loa-my-member-id-v1") ?? availableMembers[0]?.id ?? "");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loa-my-character-ids-v1")) ?? []; }
    catch { return []; }
  });
  const [personalExtraRaids, setPersonalExtraRaids] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loa-personal-extra-raids-v1")) ?? {}; }
    catch { return {}; }
  });
  const [completedRaids, setCompletedRaids] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loa-personal-completed-raids-v1")) ?? {}; }
    catch { return {}; }
  });
  const myMember = members.find((member) => String(member.id) === String(myMemberId)) ?? availableMembers[0];
  const validSelectedIds = selectedCharacterIds.filter((id) => myMember?.characters.some((character) => character.id === id));
  const effectiveSelectedIds = validSelectedIds.length ? validSelectedIds : myMember?.characters.map((character) => character.id) ?? [];
  const selectedCharacters = myMember?.characters.filter((character) => effectiveSelectedIds.includes(character.id)) ?? [];
  useEffect(() => { if (myMember?.id) localStorage.setItem("loa-my-member-id-v1", String(myMember.id)); }, [myMember?.id]);
  useEffect(() => { localStorage.setItem("loa-my-character-ids-v1", JSON.stringify(effectiveSelectedIds)); }, [effectiveSelectedIds.join("|")]);
  useEffect(() => { localStorage.setItem("loa-personal-extra-raids-v1", JSON.stringify(personalExtraRaids)); }, [personalExtraRaids]);
  useEffect(() => { localStorage.setItem("loa-personal-completed-raids-v1", JSON.stringify(completedRaids)); }, [completedRaids]);
  const completionKey = (characterId, raidName) => `${weekStart}:${characterId}:${raidName}`;
  const isRaidCompleted = (characterId, raidName) => completedRaids[completionKey(characterId, raidName)] === true;
  const toggleRaidCompleted = (characterId, raidName) => setCompletedRaids((current) => ({ ...current, [completionKey(characterId, raidName)]: !current[completionKey(characterId, raidName)] }));
  const changeMember = (memberId) => {
    const member = members.find((item) => String(item.id) === memberId);
    setMyMemberId(memberId);
    setSelectedCharacterIds(member?.characters.map((character) => character.id) ?? []);
  };
  const toggleCharacter = (characterId) => setSelectedCharacterIds((current) => {
    const base = current.filter((id) => myMember?.characters.some((character) => character.id === id));
    const selected = base.length ? base : myMember?.characters.map((character) => character.id) ?? [];
    return selected.includes(characterId) ? selected.filter((id) => id !== characterId) : [...selected, characterId];
  });
  const togglePersonalRaid = (characterId, catalogId) => setPersonalExtraRaids((current) => {
    const weekSelections = current[weekStart] ?? {};
    const selected = weekSelections[characterId] ?? [];
    const nextSelected = selected.includes(catalogId) ? selected.filter((id) => id !== catalogId) : [...selected, catalogId];
    return { ...current, [weekStart]: { ...weekSelections, [characterId]: nextSelected } };
  });
  const characterSummaries = selectedCharacters.map((character) => {
    const assignments = getCharacterAssignments(schedule, catalog, character.id, null, weekDays);
    const uniqueAssignments = [...new Map(assignments.map((assignment) => [assignment.raidName, assignment])).values()];
    const assignedRaidNames = new Set(uniqueAssignments.map((assignment) => assignment.raidName));
    const selectedPersonalRaids = [...new Map((personalExtraRaids[weekStart]?.[character.id] ?? [])
      .map((catalogId) => catalog.find((raid) => raid.id === catalogId))
      .filter((raid) => raid && raid.minLevel <= character.itemLevel && !assignedRaidNames.has(raid.name))
      .map((raid) => [raid.name, raid])).values()].slice(0, Math.max(0, 3 - uniqueAssignments.length));
    const selectedRaidNames = new Set(selectedPersonalRaids.map((raid) => raid.name));
    const bestEligibleByName = new Map();
    [...catalog].filter((raid) => raid.minLevel <= character.itemLevel).sort((left, right) => right.minLevel - left.minLevel || right.gold - left.gold).forEach((raid) => {
      if (!bestEligibleByName.has(raid.name)) bestEligibleByName.set(raid.name, raid);
    });
    const recommendationCandidates = [...bestEligibleByName.values()]
      .filter((raid) => !assignedRaidNames.has(raid.name) && !selectedRaidNames.has(raid.name))
      .sort((left, right) => right.gold - left.gold || right.minLevel - left.minLevel)
      .slice(0, 2);
    const plannedRaids = [...uniqueAssignments.map((assignment) => ({ ...assignment, name: assignment.raidName, source: "guild" })), ...selectedPersonalRaids.map((raid) => ({ ...raid, source: "personal" }))];
    return { character, assignments, uniqueAssignments, selectedPersonalRaids, plannedRaids, recommendationCandidates, count: uniqueAssignments.length + selectedPersonalRaids.length, guildCount: uniqueAssignments.length, duplicateCount: assignments.length - uniqueAssignments.length };
  });
  const totalGold = characterSummaries.reduce((total, summary) => summary.character.earnsGold === false ? total : total + [...summary.uniqueAssignments, ...summary.selectedPersonalRaids].slice(0, 3).reduce((sum, raid) => sum + raid.gold, 0), 0);
  return <section className="personal-page">
    <div className="section-heading"><div><p>내 캐릭터만 모아보기</p><h2>개인 주간 일정</h2></div></div>
    <div className="personal-settings"><label>내 멤버 별명<select value={myMember?.id ?? ""} onChange={(event) => changeMember(event.target.value)}>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div><small>표시할 캐릭터</small><div className="my-character-chips">{myMember?.characters.map((character) => <button key={character.id} className={effectiveSelectedIds.includes(character.id) ? "selected" : ""} onClick={() => toggleCharacter(character.id)}><ClassIcon className={character.className} size="small" />{character.name}<span>{character.role}</span></button>)}</div></div></div>
    <div className="personal-summary">
      <div className="personal-gold-total"><span>이번 주 예상 획득 골드</span><strong>{formatNumber(totalGold)}</strong><small>비골드 제외 · 개인 선택 포함</small></div>
      <div className="personal-raid-progress">{characterSummaries.map(({ character, count, guildCount, duplicateCount, selectedPersonalRaids, plannedRaids, recommendationCandidates }) => <div key={character.id} className={duplicateCount ? "over" : count > 3 ? "extra" : count === 3 ? "complete" : "incomplete"}>
        <span className="personal-progress-character"><ClassIcon className={character.className} size="small" />{character.name}{character.earnsGold === false && <small>비골드</small>}</span><strong>{count}/3</strong>
        <b>{duplicateCount ? `동일 레이드 ${duplicateCount}개 중복${count < 3 ? ` · ${3 - count}회 남음` : ""}` : count > 3 ? `골드 완료 · ${count - 3}회 추가 참여(골드 없음)` : count === 3 ? "완료" : `${3 - count}회 남음`}</b>
        <small className="raid-count-source">길드 {guildCount} · 개인 {selectedPersonalRaids.length}</small>
        {plannedRaids.length > 0 && <div className="personal-planned-raids">{plannedRaids.map((raid) => <div key={`${raid.source}-${raid.id ?? raid.instanceId}`} className={isRaidCompleted(character.id, raid.name) ? "checked" : ""} style={{ borderLeftColor: raid.raidColor ?? getRaidColor(raid) }}><input type="checkbox" checked={isRaidCompleted(character.id, raid.name)} aria-label={`${character.name} ${raid.name} ${raid.difficulty} 완료`} onChange={() => toggleRaidCompleted(character.id, raid.name)} /><span>{raid.name} {raid.difficulty}</span><small>{raid.source === "guild" ? `${weekDays.find((day) => day.key === raid.dayKey)?.label} ${raid.startTime || "미정"}` : "개인"}</small>{raid.source === "personal" && <button type="button" onClick={() => togglePersonalRaid(character.id, raid.id)} title="개인 선택 취소">×</button>}</div>)}</div>}
        {count < 3 && <div className="personal-raid-recommendations"><em>따로 갈 레이드 선택</em>{recommendationCandidates.map((raid) => <button key={raid.id} onClick={() => togglePersonalRaid(character.id, raid.id)} style={{ borderLeftColor: getRaidColor(raid) }}><span>{raid.name} {raid.difficulty}</span><small>Lv. {raid.minLevel} · {formatNumber(raid.gold)} G</small></button>)}</div>}
      </div>)}</div>
    </div>
    <div className="personal-week">{weekDays.map((day) => {
      const entries = characterSummaries.flatMap(({ character, assignments }) => assignments.filter((item) => item.dayKey === day.key).map((item) => ({ ...item, character })));
      return <article key={day.key} className={`${day.key === "sun" ? "sunday" : ""} ${day.key === "mobile" ? "mobile-call" : ""}`}><header><div><strong>{day.key === "mobile" ? "모바출" : `${day.label}요일`}</strong><span>{day.date}</span></div>{myMember?.unavailable.includes(day.key) && <b>불참 날짜</b>}</header><div>{entries.length ? entries.map((entry) => <section key={`${entry.character.id}-${entry.instanceId}-${entry.slotIndex}`} className={isRaidCompleted(entry.character.id, entry.raidName) ? "checked" : ""} style={{ borderLeftColor: entry.raidColor }}><div className="personal-character-name"><ClassIcon className={entry.character.className} size="small" /><strong>{entry.character.name}</strong></div><span>{entry.raidName} {entry.difficulty}</span><div className="personal-raid-meta"><small>{entry.startTime || "시간 미정"}</small><em>{entry.character.earnsGold === false ? "비골드" : `${formatNumber(entry.gold)} 골드`}</em></div><input className="personal-complete-check" type="checkbox" checked={isRaidCompleted(entry.character.id, entry.raidName)} aria-label={`${entry.character.name} ${entry.raidName} ${entry.difficulty} 완료`} onChange={() => toggleRaidCompleted(entry.character.id, entry.raidName)} /></section>) : <p>일정 없음</p>}</div></article>;
    })}</div>
  </section>;
}

function RaidsView({ catalog, setCatalog, scheduleData }) {
  const [formOpen, setFormOpen] = useState(false);
  const emptyForm = { name: "", difficulty: "", minLevel: 1700, gold: 40000, size: 4, hexColor: raidColorDefaults.blue };
  const [form, setForm] = useState(emptyForm);
  const raidUsageCounts = useMemo(() => {
    const counts = new Map();
    Object.values(scheduleData?.weeks ?? {}).forEach((week) => Object.values(week.raids ?? {}).forEach((instances) => instances.forEach((instance) => counts.set(instance.catalogId, (counts.get(instance.catalogId) ?? 0) + 1))));
    return counts;
  }, [scheduleData]);
  const changeRaidColor = (raidId, hexColor) => setCatalog((current) => current.map((raid) => raid.id === raidId ? { ...raid, hexColor } : raid));
  const saveRaid = (event) => { event.preventDefault(); setCatalog((current) => sortRaidCatalog([...current, { ...form, id: `${form.name}-${Date.now()}`, color: "blue", minLevel: Number(form.minLevel), gold: Number(form.gold), size: Number(form.size) }])); setFormOpen(false); setForm(emptyForm); };
  const deleteRaid = (raid) => {
    if ((raidUsageCounts.get(raid.id) ?? 0) > 0 || !window.confirm(`${raid.name} ${raid.difficulty} 레이드를 삭제할까요?`)) return;
    setCatalog((current) => current.filter((item) => item.id !== raid.id));
  };
  return <section className="management-page"><div className="section-heading"><div><p>레이드 조건 직접 관리</p><h2>레이드 목록</h2></div><button className="primary" onClick={() => setFormOpen(true)}>+ 새 레이드</button></div><div className="info-banner"><strong>입장 레벨 · 클리어 골드 (2026-08-05 기준)</strong><span>인벤 정리표를 기준으로 등록했습니다. 패치로 수치가 바뀌면 여기서 수정할 수 있습니다.</span></div><div className="raid-rule-list"><div className="rule-head"><span>레이드 · 색상</span><span>인원</span><span>입장 레벨</span><span>획득 골드</span><span>관리</span></div>{sortRaidCatalog(catalog).map((raid) => { const usageCount = raidUsageCounts.get(raid.id) ?? 0; return <article key={raid.id}><div><label className="raid-color-picker" aria-label={`${raid.name} ${raid.difficulty} 색상`} title="레이드 색상 변경"><input type="color" value={getRaidColor(raid)} onChange={(event) => changeRaidColor(raid.id, event.target.value)} /><i style={{ background: getRaidColor(raid) }} /></label><strong>{raid.name}</strong><span>{raid.difficulty}</span></div><b>{raid.size}인</b><b>Lv. {raid.minLevel}</b><b>{formatNumber(raid.gold)}</b><button type="button" className="delete-catalog-raid" disabled={usageCount > 0} title={usageCount ? `${usageCount}개 주간 일정에서 사용 중이라 삭제할 수 없습니다.` : "레이드 삭제"} onClick={() => deleteRaid(raid)}>{usageCount ? `사용 중 ${usageCount}` : "삭제"}</button></article>; })}</div>{formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setFormOpen(false)}><form className="modal raid-form" onSubmit={saveRaid} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>관리자 등록</p><h3>새 레이드 조건</h3></div><button type="button" onClick={() => setFormOpen(false)}>닫기</button></div><label>레이드명<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="예: 세르카" /></label><label>난이도<input required value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} placeholder="예: 하드" /></label><div className="form-row"><label>입장 아이템 레벨<input type="number" value={form.minLevel} onChange={(event) => setForm({ ...form, minLevel: event.target.value })} /></label><label>획득 골드<input type="number" value={form.gold} onChange={(event) => setForm({ ...form, gold: event.target.value })} /></label></div><div className="form-row"><label>공대 인원<select value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })}><option value="4">4인</option><option value="8">8인</option></select></label><label>레이드 색상<input className="raid-form-color" type="color" value={form.hexColor} onChange={(event) => setForm({ ...form, hexColor: event.target.value })} /></label></div><button className="primary full" type="submit">레이드 저장</button></form></div>}</section>;
}

export function App() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [activeWeekStart, setActiveWeekStart] = useState(() => clampVisibleWeek(localStorage.getItem("loa-active-week-v1") ?? currentWeekStart));
  const [members, setMembers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("loa-raid-members-v2")) ?? initialGuildMembers;
      return normalizeMembers(saved);
    } catch { return normalizeMembers(initialGuildMembers); }
  });
  const [catalog, setCatalog] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("loa-raid-catalog-v1")) ?? initialCatalog;
      return normalizeCatalog(saved);
    } catch { return normalizeCatalog(initialCatalog); }
  });
  const [scheduleData, setScheduleData] = useState(() => {
    try { return normalizeScheduleData(JSON.parse(localStorage.getItem("loa-raid-schedule-v1")) ?? initialSchedule, members); }
    catch { return normalizeScheduleData(initialSchedule, members); }
  });
  const [isDirty, setIsDirty] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(supabase ? "connecting" : "offline");
  const [cloudMessage, setCloudMessage] = useState("");
  const cloudReadyRef = useRef(false);
  const lastSyncedRef = useRef({ members: "", catalog: "", schedule: "" });
  const savedStateRef = useRef({ members, catalog, schedule: scheduleData });
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    let channel;
    const applyCloudState = (row) => {
      const loadedMembers = normalizeMembers(row.members ?? initialGuildMembers);
      const nextState = {
        members: loadedMembers,
        catalog: normalizeCatalog(row.catalog ?? initialCatalog),
        schedule: normalizeScheduleData(row.schedule ?? initialSchedule, loadedMembers),
      };
      lastSyncedRef.current = {
        members: JSON.stringify(nextState.members),
        catalog: JSON.stringify(nextState.catalog),
        schedule: JSON.stringify(row.schedule ?? initialSchedule),
      };
      savedStateRef.current = nextState;
      setMembers(nextState.members);
      setCatalog(nextState.catalog);
      setScheduleData(nextState.schedule);
      setIsDirty(false);
    };
    const connect = async () => {
      setCloudStatus("connecting");
      const { data, error } = await supabase.from("raid_board_state").select("members,catalog,schedule").eq("id", "guild-main").maybeSingle();
      if (cancelled) return;
      if (error) {
        setCloudStatus("error");
        setCloudMessage(error.code === "PGRST205" ? "Supabase에서 초기 설정 SQL을 실행해주세요." : error.message);
        return;
      }
      if (data) {
        applyCloudState(data);
      } else {
        const initialState = { members, catalog, schedule: scheduleData };
        const { error: createError } = await supabase.from("raid_board_state").upsert({ id: "guild-main", ...initialState, updated_at: new Date().toISOString() });
        if (cancelled) return;
        if (createError) {
          setCloudStatus("error");
          setCloudMessage(createError.message);
          return;
        }
        lastSyncedRef.current = {
          members: JSON.stringify(initialState.members),
          catalog: JSON.stringify(initialState.catalog),
          schedule: JSON.stringify(initialState.schedule),
        };
      }
      cloudReadyRef.current = true;
      setCloudStatus("connected");
      setCloudMessage("");
      channel = supabase.channel("raid-board-state")
        .on("postgres_changes", { event: "*", schema: "public", table: "raid_board_state", filter: "id=eq.guild-main" }, (payload) => {
          if (payload.new?.members && !savingRef.current) applyCloudState(payload.new);
          setCloudStatus("connected");
          setCloudMessage("");
        })
        .subscribe();
    };
    connect();
    return () => {
      cancelled = true;
      cloudReadyRef.current = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => { localStorage.setItem("loa-active-week-v1", activeWeekStart); }, [activeWeekStart]);
  const updateMembers = (value) => { setIsDirty(true); setMembers(value); };
  const updateCatalog = (value) => { setIsDirty(true); setCatalog(value); };
  const updateScheduleData = (value) => { setIsDirty(true); setScheduleData(value); };
  const cancelChanges = () => {
    const saved = savedStateRef.current;
    setMembers(saved.members);
    setCatalog(saved.catalog);
    setScheduleData(saved.schedule);
    setIsDirty(false);
  };
  const saveChanges = async () => {
    const state = { members, catalog, schedule: scheduleData };
    if (supabase && !cloudReadyRef.current) {
      setCloudMessage("공용 DB 연결이 끝난 뒤 저장해주세요.");
      return;
    }
    setIsSaving(true);
    savingRef.current = true;
    if (supabase) {
      setCloudStatus("saving");
      const changedFields = Object.entries(state).filter(([field, value]) => JSON.stringify(value) !== lastSyncedRef.current[field]);
      const results = await Promise.all(changedFields.map(([field, value]) => supabase.from("raid_board_state").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", "guild-main")));
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        setCloudStatus("error");
        setCloudMessage(failed.error.message);
        savingRef.current = false;
        setIsSaving(false);
        return;
      }
      lastSyncedRef.current = Object.fromEntries(Object.entries(state).map(([field, value]) => [field, JSON.stringify(value)]));
      setCloudStatus("connected");
      setCloudMessage("");
    }
    localStorage.setItem("loa-raid-members-v2", JSON.stringify(state.members));
    localStorage.setItem("loa-raid-catalog-v1", JSON.stringify(state.catalog));
    localStorage.setItem("loa-raid-schedule-v1", JSON.stringify(state.schedule));
    savedStateRef.current = state;
    setIsDirty(false);
    savingRef.current = false;
    setIsSaving(false);
  };

  const weekDays = useMemo(() => getWeekDays(activeWeekStart), [activeWeekStart]);
  const currentWeek = scheduleData.weeks[activeWeekStart] ?? { raids: emptyRaidDays(), unavailableByMember: {} };
  const schedule = currentWeek.raids;
  const effectiveMembers = useMemo(() => members.map((member) => ({ ...member, unavailable: currentWeek.unavailableByMember[String(member.id)] ?? [] })), [members, currentWeek]);
  const setCurrentSchedule = (updater) => updateScheduleData((current) => {
    const existingWeek = current.weeks[activeWeekStart] ?? { raids: emptyRaidDays(), unavailableByMember: {} };
    const nextRaids = typeof updater === "function" ? updater(existingWeek.raids) : updater;
    return { ...current, weeks: { ...current.weeks, [activeWeekStart]: { ...existingWeek, raids: normalizeRaidDays(nextRaids) } } };
  });
  const toggleUnavailable = (memberId, dayKey) => updateScheduleData((current) => {
    const existingWeek = current.weeks[activeWeekStart] ?? { raids: emptyRaidDays(), unavailableByMember: {} };
    const memberKey = String(memberId);
    const unavailable = existingWeek.unavailableByMember[memberKey] ?? [];
    const nextUnavailable = unavailable.includes(dayKey) ? unavailable.filter((key) => key !== dayKey) : [...unavailable, dayKey];
    return { ...current, weeks: { ...current.weeks, [activeWeekStart]: { ...existingWeek, unavailableByMember: { ...existingWeek.unavailableByMember, [memberKey]: nextUnavailable } } } };
  });
  const copyToNextWeek = () => {
    const targetWeekStart = shiftWeekKey(activeWeekStart, 1);
    if (targetWeekStart > latestVisibleWeekStart) return;
    const source = scheduleData.weeks[activeWeekStart];
    const sourceRaidCount = scheduleDayKeys.reduce((count, key) => count + (source?.raids?.[key]?.length ?? 0), 0);
    if (!sourceRaidCount) {
      window.alert("현재 주 일정이 비어 있어 다음 주로 복사할 수 없습니다.");
      return;
    }
    const target = scheduleData.weeks[targetWeekStart];
    const targetRaidCount = scheduleDayKeys.reduce((count, key) => count + (target?.raids?.[key]?.length ?? 0), 0);
    if (targetRaidCount) {
      const confirmation = window.prompt(`다음 주 기존 일정 ${targetRaidCount}개가 모두 지워지고, 현재 주 일정 ${sourceRaidCount}개로 교체됩니다.\n\n계속하려면 '덮어쓰기'를 입력하세요.`);
      if (confirmation?.trim() !== "덮어쓰기") return;
    }
    updateScheduleData((current) => {
      const currentSource = current.weeks[activeWeekStart];
      const currentSourceRaidCount = scheduleDayKeys.reduce((count, key) => count + (currentSource?.raids?.[key]?.length ?? 0), 0);
      if (!currentSourceRaidCount) return current;
      const copiedRaids = JSON.parse(JSON.stringify(currentSource.raids));
      return { ...current, weeks: { ...current.weeks, [targetWeekStart]: { raids: normalizeRaidDays(copiedRaids), unavailableByMember: {} } } };
    });
    setActiveWeekStart(targetWeekStart);
  };

  const cloudText = { connecting: "공용 DB 연결 중", connected: "공용 DB 연결됨", saving: "공용 일정 저장 중", error: "공용 DB 설정 필요", offline: "브라우저에만 저장 중" }[cloudStatus];
  const canGoNext = activeWeekStart < latestVisibleWeekStart;
  const canCopyNextWeek = canGoNext && scheduleDayKeys.some((key) => schedule[key]?.length);
  return <div className="app-shell"><AppHeader activeTab={activeTab} setActiveTab={setActiveTab} /><div className={`cloud-status ${cloudStatus}`} title={cloudMessage}><i /><span>{cloudText}</span>{cloudMessage && <small>{cloudMessage}</small>}</div><div className="page-wrap">{activeTab === "schedule" && <ScheduleView members={effectiveMembers} catalog={catalog} schedule={schedule} setSchedule={setCurrentSchedule} weekDays={weekDays} weekStart={activeWeekStart} canGoPrevious={activeWeekStart > earliestVisibleWeekStart} canGoNext={canGoNext} canCopyNextWeek={canCopyNextWeek} onPreviousWeek={() => setActiveWeekStart((weekStart) => clampVisibleWeek(shiftWeekKey(weekStart, -1)))} onCurrentWeek={() => setActiveWeekStart(currentWeekStart)} onNextWeek={() => setActiveWeekStart((weekStart) => clampVisibleWeek(shiftWeekKey(weekStart, 1)))} onCopyNextWeek={copyToNextWeek} onToggleUnavailable={toggleUnavailable} />}{activeTab === "personal" && <PersonalScheduleView members={effectiveMembers} schedule={schedule} catalog={catalog} weekDays={weekDays} weekStart={activeWeekStart} />}{activeTab === "members" && <MembersView members={effectiveMembers} setMembers={updateMembers} schedule={schedule} setSchedule={setCurrentSchedule} catalog={catalog} weekDays={weekDays} />}{activeTab === "raids" && <RaidsView catalog={catalog} setCatalog={updateCatalog} scheduleData={scheduleData} />}<SaveChangesBar isDirty={isDirty} isSaving={isSaving} onCancel={cancelChanges} onSave={saveChanges} /></div></div>;
}
