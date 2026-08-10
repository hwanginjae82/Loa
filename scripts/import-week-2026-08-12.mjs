import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envText = fs.readFileSync(path.resolve(".env.local"), "utf8");
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
  const split = line.indexOf("=");
  return [line.slice(0, split), line.slice(split + 1)];
}));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: row, error } = await supabase.from("raid_board_state").select("members,catalog,schedule").eq("id", "guild-main").single();
if (error) throw error;

const members = structuredClone(row.members);
for (const member of members) member.characters = member.characters.map((character, index) => ({ ...character, earnsGold: character.earnsGold ?? index < 6 }));
const extraCharacters = [
  { memberId: "guild-3", character: { id: "guild-3-extra-1", name: "블레이드자쿠", className: "블레이드", role: "딜러", itemLevel: 1754.17, earnsGold: false } },
  { memberId: "guild-5", character: { id: "guild-5-extra-1", name: "테네오", className: "차원술사", role: "딜러", itemLevel: 1735, earnsGold: false } },
];
for (const { memberId, character: extraCharacter } of extraCharacters) {
  const member = members.find((item) => item.id === memberId);
  if (member && !member.characters.some((character) => character.name === extraCharacter.name)) member.characters.push(extraCharacter);
}
const byCharacterName = new Map(members.flatMap((member) => member.characters.map((character) => [character.name, { member, character }])));
const aliasNames = {
  "모민쵸": "모카민트초코", "모카도화": "카페모카휘핑빼고", "모카요거트": "모카요거트",
  "스카치": "스카치멜로우", "스카치도화": "세화해변", "스카치홀리": "멍멍제과당", "스카치발키리": "제주소금빵",
  "스카치차원": "테네오", "스카치망식": "망고식스", "스카치블레": "제주오설록",
  "자쿠": "뎀쿠", "자쿠바드": "버블맛집", "자쿠발키리": "커세어보다발키리", "자쿠우산": "우산자쿠",
  "자쿠워붕": "워붕이자쿠", "자쿠환수": "농부의길", "자쿠블레": "블레이드자쿠",
  "아쀼님": "아쀼님", "아쀼닝": "아쀼닝", "우비냥아리": "우비냥아리", "아리는애옹": "아리는애옹",
  "아리는빵야": "아리는빵야", "아리도련님": "아리도련님",
  "김밥": "김밥과초밥", "김밥브커": "서바이벌김밥", "김밥디트": "돈까스김밥과초밥", "김밥블레": "김밥and초밥",
  "김밥홀리": "초밥and김밥", "김밥용기사": "김밥초밥",
  "안나뽕": "배라민트초코파인트", "안나뽕환수": "안녕나여범이", "안나뽕용기사": "안녕나용범이",
  "안나뽕발키리": "안녕나유범이", "안나뽕기공": "안녕나도범이",
  "로젠도화": "쪼꼬는팡팡", "로젠홀리": "쪼꼬는망고", "로젠바드": "로젠고양이택배",
  "반야": "반야천성", "반야데헌": "황야의무법자김반야", "반야소울": "사신김반야", "반야유산": "아이언맨김반야",
  "헤헤": "헤헤D", "헤헤소울": "여름엔치맥", "헤헤배마": "헤헤x", "헤헤바드": "헤헤82",
  "헤헤기상": "기상청알파고", "헤헤발키리": "헤헤님",
  "저받인파": "저받인파", "저받기공": "당진야호", "뚜비냥냥": "뚜비냥냥", "뚜비차원": "차원우유냥", "꾸링": "꾸링이",
};

const character = (alias) => {
  if (alias === null) return null;
  const exactName = aliasNames[alias];
  const found = byCharacterName.get(exactName);
  if (!found) throw new Error(`캐릭터 매칭 실패: ${alias} -> ${exactName}`);
  return found.character.id;
};

for (const alias of ["자쿠발키리", "안나뽕발키리", "아리는빵야", "헤헤발키리"]) {
  byCharacterName.get(aliasNames[alias]).character.role = "딜러";
}

const defaultTime = "20:30";
let sequence = 1;
const raid = (catalogId, aliases, mobile = false) => ({
  id: 202608120000 + sequence++, catalogId, characterIds: aliases.map(character), startTime: mobile ? "" : defaultTime,
});

const raids = {
  wed: [
    raid("jongmak-hard", ["모민쵸", "아리도련님", "김밥", "안나뽕기공", "로젠홀리", "스카치차원", "반야소울", null]),
    raid("jongmak-hard", ["스카치", "아쀼님", "안나뽕발키리", "저받기공", "모카도화", "반야유산", "뚜비차원", null]),
    raid("sungsimdang-3", ["스카치", "자쿠", "아쀼님", "김밥"]),
    raid("serka-nightmare", ["스카치", "자쿠", "아쀼님", "김밥"]),
    raid("sungsimdang-3", ["스카치발키리", "자쿠환수", "우비냥아리", "김밥디트"]),
    raid("sungsimdang-3", ["모카요거트", "헤헤", "안나뽕", "반야"]),
    raid("serka-nightmare", ["모카요거트", "헤헤", "안나뽕", "반야"]),
  ],
  thu: [
    raid("belgarden-normal", ["스카치도화", "아리는빵야", "김밥용기사", "자쿠환수", "헤헤바드", null, null, null]),
    raid("serka-hard", ["헤헤바드", "스카치차원", "아리는빵야", "김밥용기사"]),
    raid("sungsimdang-3", ["스카치도화", "헤헤소울", "아리는애옹", "김밥용기사"]),
    raid("serka-hard", ["스카치홀리", "헤헤기상", "아리는애옹", "김밥디트"]),
    raid("sungsimdang-3", ["스카치홀리", "헤헤기상", "아쀼님", "김밥블레"]),
    raid("sungsimdang-2", ["로젠바드", "자쿠블레", "뚜비차원", "반야유산"]),
    raid("serka-hard", ["로젠홀리", "자쿠환수", "뚜비차원", "안나뽕용기사"]),
    raid("sungsimdang-3", ["로젠홀리", "자쿠워붕", "뚜비냥냥", "안나뽕용기사"]),
  ],
  fri: [
    raid("belgarden-hard", ["스카치발키리", "우비냥아리", "김밥브커", "자쿠발키리", null, null, "안나뽕환수", "헤헤소울"]),
    raid("serka-nightmare", ["스카치발키리", "자쿠발키리", "우비냥아리", "김밥브커"]),
    raid("sungsimdang-3", ["김밥홀리", "자쿠우산", "아리는빵야", "스카치망식"]),
    raid("serka-hard", ["모민쵸", "헤헤발키리", "안나뽕기공", "반야유산"]),
    raid("sungsimdang-2", ["모민쵸", "헤헤발키리", "안나뽕기공", "반야유산"]),
  ],
  sat: [
    raid("belgarden-hard", ["스카치", "아쀼님", "김밥", "자쿠", "모카요거트", "안나뽕", "헤헤", "반야"]),
    raid("belgarden-normal", ["김밥홀리", "아리는애옹", "스카치망식", "반야데헌", "모민쵸", "안나뽕용기사", "헤헤발키리", "자쿠우산"]),
    raid("sungsimdang-2", ["모카도화", "안나뽕발키리", "스카치차원", "아리도련님"]),
    raid("serka-hard", ["모카도화", "안나뽕발키리", "스카치차원", "아리도련님"]),
  ],
  sun: [
    raid("belgarden-normal", ["스카치홀리", "자쿠워붕", "김밥블레", "헤헤기상", null, null, null, null]),
    raid("serka-nightmare", ["자쿠바드", "뚜비냥냥", "스카치블레", "헤헤배마"]),
    raid("sungsimdang-3", ["자쿠바드", null, "스카치블레", "헤헤배마"]),
  ],
  mon: [
    raid("belgarden-hard", ["자쿠바드", "아쀼님", "헤헤배마", "스카치블레", null, "김밥디트", null, null]),
    raid("serka-nightmare", ["스카치도화", "아쀼닝", "자쿠우산", "헤헤소울"]),
  ],
  tue: [],
  mobile: [
    raid("serka-hard", ["로젠도화", "자쿠워붕", "꾸링", "김밥블레"], true),
    raid("sungsimdang-3", ["로젠도화", "자쿠발키리", "반야데헌", "김밥브커"], true),
    raid("serka-nightmare", ["모민쵸", "안나뽕환수", "저받인파", "반야데헌"], true),
    raid("sungsimdang-3", ["모민쵸", "안나뽕환수", "저받인파", null], true),
  ],
};

const catalogAdditions = [
  { id: "fourth-act-normal", name: "4막", difficulty: "노말", minLevel: 1700, gold: 27000, size: 8, color: "gray", hexColor: "#aaaaaa" },
  { id: "fourth-act-hard", name: "4막", difficulty: "하드", minLevel: 1720, gold: 38000, size: 8, color: "gray", hexColor: "#aaaaaa" },
  { id: "jongmak-normal", name: "종막", difficulty: "노말", minLevel: 1710, gold: 32000, size: 8, color: "gray", hexColor: "#aaaaaa" },
  { id: "serka-normal", name: "세르카", difficulty: "노말", minLevel: 1710, gold: 32000, size: 4, color: "blue", hexColor: "#0f9dd2" },
  { id: "sungsimdang-1", name: "성심당", difficulty: "1단계", minLevel: 1700, gold: 30000, size: 4, color: "yellow", hexColor: "#f4d576" },
  { id: "belgarden-nightmare", name: "벨가르딘", difficulty: "나메", minLevel: 1780, gold: 75000, size: 8, color: "purple", hexColor: "#85619e" },
];
const catalog = [...row.catalog];
for (const item of catalogAdditions) if (!catalog.some((raidItem) => raidItem.id === item.id)) catalog.push(item);

const nextSchedule = row.schedule?.version === 2 ? structuredClone(row.schedule) : { version: 2, weeks: {} };
const unavailableByMember = nextSchedule.weeks?.["2026-08-12"]?.unavailableByMember ?? {};
nextSchedule.weeks ??= {};
nextSchedule.weeks["2026-08-12"] = { raids, unavailableByMember };

const catalogById = new Map(catalog.map((item) => [item.id, item]));
const roster = new Map(members.flatMap((member) => member.characters.map((item) => [item.id, { ...item, memberId: member.id, memberName: member.name }])));
const occurrencesByMember = new Map();
for (const [day, items] of Object.entries(raids)) for (const item of items) {
  const rule = catalogById.get(item.catalogId);
  item.characterIds.forEach((id, slotIndex) => {
    if (!id) return;
    const selected = roster.get(id);
    const occurrence = { day, item, slotIndex, currentId: id, family: rule.name, minLevel: rule.minLevel, role: slotIndex % 4 === 0 ? "서폿" : "딜러" };
    occurrencesByMember.set(selected.memberId, [...(occurrencesByMember.get(selected.memberId) ?? []), occurrence]);
  });
}

const corrections = [];
const solverFailures = [];
for (const member of members) {
  const occurrences = occurrencesByMember.get(member.id) ?? [];
  if (!occurrences.length) continue;
  const prepared = occurrences.map((occurrence) => ({
    ...occurrence,
    candidates: member.characters
      .filter((candidate) => candidate.role === occurrence.role && candidate.itemLevel >= occurrence.minLevel)
      .sort((left, right) => Number(right.id === occurrence.currentId) - Number(left.id === occurrence.currentId) || left.itemLevel - right.itemLevel),
  })).sort((left, right) => left.candidates.length - right.candidates.length);
  if (prepared.some((occurrence) => !occurrence.candidates.length)) throw new Error(`${member.name}: 역할·레벨을 만족하는 캐릭터가 없는 일정이 있습니다.`);

  const usage = new Map(member.characters.map((candidate) => [candidate.id, { count: 0, families: new Set() }]));
  const selectedByOccurrence = new Map();
  const solve = (index) => {
    if (index === prepared.length) return true;
    const occurrence = prepared[index];
    for (const candidate of occurrence.candidates) {
      const state = usage.get(candidate.id);
      if (state.count >= 3 || state.families.has(occurrence.family)) continue;
      state.count += 1; state.families.add(occurrence.family); selectedByOccurrence.set(occurrence, candidate.id);
      if (solve(index + 1)) return true;
      state.count -= 1; state.families.delete(occurrence.family); selectedByOccurrence.delete(occurrence);
    }
    return false;
  };
  if (!solve(0)) {
    solverFailures.push({ member: member.name, occurrenceCount: prepared.length, occurrences: prepared.map(({ day, family, role, minLevel }) => ({ day, family, role, minLevel })) });
    continue;
  }
  for (const occurrence of prepared) {
    const nextId = selectedByOccurrence.get(occurrence);
    occurrence.item.characterIds[occurrence.slotIndex] = nextId;
    if (nextId !== occurrence.currentId) corrections.push({
      member: member.name, day: occurrence.day, raid: occurrence.family,
      from: roster.get(occurrence.currentId).name, to: roster.get(nextId).name,
    });
  }
}

const warnings = [];
const weeklyUsage = new Map();
for (const [day, items] of Object.entries(raids)) for (const item of items) {
  const rule = catalogById.get(item.catalogId);
  item.characterIds.forEach((id, slotIndex) => {
    if (!id) return;
    const selected = roster.get(id);
    const requiredRole = slotIndex % 4 === 0 ? "서폿" : "딜러";
    if (selected.role !== requiredRole) warnings.push(`${day} ${rule.name} ${selected.name}: ${requiredRole} 자리 / ${selected.role}`);
    if (selected.itemLevel < rule.minLevel) warnings.push(`${day} ${rule.name} ${selected.name}: Lv.${selected.itemLevel} / 필요 ${rule.minLevel}`);
    const usage = weeklyUsage.get(id) ?? { count: 0, families: new Set() };
    usage.count += 1;
    if (usage.families.has(rule.name)) warnings.push(`${selected.name}: ${rule.name} 주간 중복 참가`);
    usage.families.add(rule.name);
    weeklyUsage.set(id, usage);
  });
}
for (const [id, usage] of weeklyUsage) if (usage.count > 3) warnings.push(`${roster.get(id).name}: 주간 ${usage.count}회 참가`);

console.log(JSON.stringify({
  currentRaidCounts: Object.fromEntries(Object.entries(row.schedule?.weeks?.["2026-08-12"]?.raids ?? {}).map(([day, items]) => [day, items.length])),
  importRaidCounts: Object.fromEntries(Object.entries(raids).map(([day, items]) => [day, items.length])),
  memberOccurrenceCounts: Object.fromEntries(members.map((member) => [member.name, occurrencesByMember.get(member.id)?.length ?? 0])),
  correctionCount: corrections.length,
  corrections,
  solverFailures,
  warnings,
}, null, 2));
if (process.argv.includes("--apply")) {
  if (solverFailures.length || warnings.length) throw new Error("규칙 위반이 남아 있어 DB에 저장하지 않았습니다.");
  const { error: updateError } = await supabase.from("raid_board_state").update({ members, catalog, schedule: nextSchedule, updated_at: new Date().toISOString() }).eq("id", "guild-main");
  if (updateError) throw updateError;
  console.log("APPLIED");
}
