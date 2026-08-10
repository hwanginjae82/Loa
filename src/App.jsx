import { useEffect, useMemo, useRef, useState } from "react";
import { initialGuildMembers } from "./initialGuildMembers.js";
import { supabase } from "./supabase.js";
import { SaveChangesBar } from "./SaveChangesBar.jsx";

const weekDays = [
  { key: "wed", label: "수", full: "수요일", date: "8/12" },
  { key: "thu", label: "목", full: "목요일", date: "8/13" },
  { key: "fri", label: "금", full: "금요일", date: "8/14" },
  { key: "sat", label: "토", full: "토요일", date: "8/15" },
  { key: "sun", label: "일", full: "일요일", date: "8/16" },
  { key: "mon", label: "월", full: "월요일", date: "8/17" },
  { key: "tue", label: "화", full: "화요일", date: "8/18" },
];

const palette = ["#ffd131", "#94d451", "#edaedf", "#f1c09f", "#9fc3ed", "#87e4e1", "#d7d7d7", "#dcb17a", "#c7b4f3", "#f3a6a6", "#a8d8b9", "#f6d58f", "#b7c9f2", "#d9a9c7", "#a9d9d4", "#c8b58d"];
const raidColorDefaults = { gray: "#aaaaaa", blue: "#0f9dd2", gold: "#c49b00", yellow: "#f4d576", purple: "#85619e" };
const getRaidColor = (raid) => raid.hexColor ?? raidColorDefaults[raid.color] ?? "#aaaaaa";
const normalizeMembers = (members) => {
  const colorById = new Map(initialGuildMembers.map((member, index) => [member.id, palette[index % palette.length]]));
  return members.map((member, index) => ({ ...member, color: member.color ?? colorById.get(member.id) ?? palette[index % palette.length] }));
};
const normalizeCatalog = (catalog) => catalog.map((raid) => ({ ...raid, hexColor: getRaidColor(raid) }));
const cloudFingerprint = ({ members, catalog, schedule }) => JSON.stringify({ members, catalog, schedule });
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
  { id: "jongmak-hard", name: "종막", difficulty: "하드", minLevel: 1730, gold: 48000, size: 8, color: "gray" },
  { id: "serka-hard", name: "세르카", difficulty: "하드", minLevel: 1730, gold: 44000, size: 4, color: "blue" },
  { id: "serka-nightmare", name: "세르카", difficulty: "나메", minLevel: 1740, gold: 54000, size: 4, color: "blue" },
  { id: "sungsimdang-3", name: "성심당", difficulty: "3단계", minLevel: 1750, gold: 50000, size: 4, color: "gold" },
  { id: "sungsimdang-2", name: "성심당", difficulty: "2단계", minLevel: 1720, gold: 40000, size: 4, color: "yellow" },
  { id: "belgarden-hard", name: "벨가르딘", difficulty: "하드", minLevel: 1770, gold: 62000, size: 8, color: "purple" },
  { id: "belgarden-normal", name: "벨가르딘", difficulty: "노말", minLevel: 1750, gold: 50000, size: 8, color: "purple" },
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

function RaidCard({ instance, catalog, roster, day, onSlotClick }) {
  const raid = catalog.find((item) => item.id === instance.catalogId);
  const slots = Array.from({ length: raid.size }, (_, index) => instance.characterIds[index] ?? null);
  const parties = raid.size === 8 ? [slots.slice(0, 4), slots.slice(4, 8)] : [slots];
  return <article className="raid-card">
    <div className={`raid-title ${raid.color}`} style={{ background: getRaidColor(raid) }}><strong>{raid.name} {raid.difficulty}</strong><span>{raid.size}인</span></div>
    <div className="requirement-row"><span>입장 레벨</span><strong>Lv. {raid.minLevel}</strong><span>획득 골드</span><strong>{formatNumber(raid.gold)}</strong></div>
    {parties.map((party, partyIndex) => <div className="party" key={partyIndex}>
      <div className="party-label">{raid.size === 8 ? `${partyIndex + 1}파티` : "파티"}</div>
      <div className="role-labels"><span>서폿</span><span>딜러</span><span>딜러</span><span>딜러</span></div>
      <div className="slots">{party.map((characterId, slotIndex) => {
        const absoluteSlot = partyIndex * 4 + slotIndex;
        const character = roster.find((item) => item.id === characterId);
        const roleMismatch = character && ((slotIndex === 0 && character.role !== "서폿") || (slotIndex > 0 && character.role !== "딜러"));
        return <button key={absoluteSlot} className={`slot ${!character ? "empty" : ""} ${roleMismatch ? "role-mismatch" : ""}`} style={character ? { background: character.color } : undefined} onClick={() => onSlotClick(instance.id, absoluteSlot)}>
          <span>{character?.name ?? (slotIndex === 0 ? "서폿 필요" : "딜러 필요")}</span>
          {character && <StatusBadge character={character} day={day} raid={raid} />}
        </button>;
      })}</div>
    </div>)}
  </article>;
}

function getCharacterAssignments(schedule, catalog, characterId, ignoredSlot = null) {
  return Object.entries(schedule).flatMap(([dayKey, raids]) => raids.flatMap((instance) => instance.characterIds.flatMap((id, slotIndex) => {
    if (id !== characterId) return [];
    if (ignoredSlot && ignoredSlot.dayKey === dayKey && ignoredSlot.instanceId === instance.id && ignoredSlot.slotIndex === slotIndex) return [];
    const raid = catalog.find((item) => item.id === instance.catalogId);
    const day = weekDays.find((item) => item.key === dayKey);
    return [{ dayKey, instanceId: instance.id, slotIndex, raidName: raid?.name ?? "레이드", difficulty: raid?.difficulty ?? "", label: `${day?.label ?? dayKey} ${raid?.name ?? "레이드"} ${raid?.difficulty ?? ""}`.trim() }];
  })));
}

function AssignmentModal({ members, roster, assignment, schedule, dayRaids, catalog, selectedDay, onAssign, onClose }) {
  const raidInstance = dayRaids.find((item) => item.id === assignment.instanceId);
  const raid = catalog.find((item) => item.id === raidInstance.catalogId);
  const targetRole = assignment.slotIndex % 4 === 0 ? "서폿" : "딜러";
  const occupiedMemberIds = new Set(raidInstance.characterIds
    .filter((_, index) => index !== assignment.slotIndex)
    .map((id) => roster.find((character) => character.id === id)?.memberId)
    .filter(Boolean));
  const candidates = members
    .filter((member) => member.active !== false && !occupiedMemberIds.has(member.id))
    .map((member) => ({ member, characters: member.characters
      .map((character) => ({ ...character, assignments: getCharacterAssignments(schedule, catalog, character.id, { dayKey: selectedDay, instanceId: assignment.instanceId, slotIndex: assignment.slotIndex }) }))
      .filter((character) => character.role === targetRole && character.itemLevel >= raid.minLevel && character.assignments.length < 3) }))
    .filter((item) => item.characters.length);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal roster-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{targetRole} 슬롯 · 입장 레벨 이상 · 주간 3회 미만</p><h3>{targetRole} 캐릭터 선택</h3></div><button onClick={onClose}>닫기</button></div><button className="remove-member" onClick={() => onAssign(null)}>빈자리로 두기</button>{!candidates.length && <div className="api-error"><strong>선택 가능한 캐릭터가 없습니다.</strong><span>멤버 활성 상태, 역할, 입장 레벨, 주간 3회 사용 여부를 확인해주세요.</span></div>}<div className="roster-picker">{candidates.map(({ member, characters }) => <section key={member.id}><div className="picker-member"><i style={{ background: member.color }} /><strong>{member.name}</strong><span>{characters.length}개 {targetRole}</span>{member.unavailable.includes(selectedDay) && <b>오늘 불가</b>}</div><div>{characters.map((character) => { const warning = member.unavailable.includes(selectedDay); return <button key={character.id} onClick={() => onAssign(character.id)}><strong>{character.name}</strong><small>{character.className} · {character.role} · Lv. {character.itemLevel}<span className="raid-usage">주간 {character.assignments.length}/3{character.assignments.length ? ` · ${character.assignments.map((item) => item.label).join(", ")}` : " · 배정 없음"}</span></small><b className={warning ? "bad" : "good"}>{warning ? "요일 확인" : "선택"}</b></button>; })}</div></section>)}</div></section></div>;
}

function ScheduleView({ members, catalog, schedule, setSchedule }) {
  const roster = useMemo(() => flattenCharacters(members), [members]);
  const [selectedDay, setSelectedDay] = useState("wed");
  const [assignment, setAssignment] = useState(null);
  const [showAddRaid, setShowAddRaid] = useState(false);
  const dayInfo = weekDays.find((day) => day.key === selectedDay);
  const dayRaids = schedule[selectedDay] ?? [];

  const assignCharacter = (characterId) => {
    if (characterId) {
      const raidInstance = dayRaids.find((raid) => raid.id === assignment.instanceId);
      const candidate = roster.find((character) => character.id === characterId);
      const targetRole = assignment.slotIndex % 4 === 0 ? "서폿" : "딜러";
      const duplicateMember = raidInstance.characterIds.some((id, index) => index !== assignment.slotIndex && roster.find((character) => character.id === id)?.memberId === candidate?.memberId);
      const raid = catalog.find((item) => item.id === raidInstance.catalogId);
      const weeklyAssignments = getCharacterAssignments(schedule, catalog, characterId, { dayKey: selectedDay, instanceId: assignment.instanceId, slotIndex: assignment.slotIndex });
      if (!candidate || candidate.role !== targetRole || candidate.itemLevel < raid.minLevel || duplicateMember || weeklyAssignments.length >= 3) return;
    }
    setSchedule((current) => ({ ...current, [selectedDay]: current[selectedDay].map((raid) => raid.id === assignment.instanceId
      ? { ...raid, characterIds: Array.from({ length: catalog.find((item) => item.id === raid.catalogId).size }, (_, index) => index === assignment.slotIndex ? characterId : raid.characterIds[index] ?? null) }
      : raid) }));
    setAssignment(null);
  };
  const addRaid = (catalogId) => { setSchedule((current) => ({ ...current, [selectedDay]: [...current[selectedDay], { id: Date.now(), catalogId, characterIds: [] }] })); setShowAddRaid(false); };
  const warningCount = useMemo(() => dayRaids.reduce((count, instance) => {
    const raid = catalog.find((item) => item.id === instance.catalogId);
    return count + instance.characterIds.filter((id) => { const character = roster.find((item) => item.id === id); return character && (character.unavailable.includes(selectedDay) || character.itemLevel < raid.minLevel); }).length;
  }, 0), [dayRaids, catalog, roster, selectedDay]);

  return <>
    <section className="week-toolbar"><button className="text-button">이전 주</button><div><span>2026년 8월 12일</span><strong>8월 3주차</strong></div><button className="text-button">다음 주</button></section>
    <section className="day-tabs" aria-label="요일 선택">{weekDays.map((day) => <button key={day.key} className={`${selectedDay === day.key ? "active" : ""} ${day.key === "sun" ? "sunday" : ""}`} onClick={() => setSelectedDay(day.key)}><span>{day.label}</span><strong>{day.date}</strong><small>{schedule[day.key]?.length ?? 0}개</small></button>)}</section>
    <div className="content-grid"><main className="schedule-panel"><div className="section-heading"><div><p>{dayInfo.date}</p><h2>{dayInfo.full} 공대 일정</h2></div><button className="primary" onClick={() => setShowAddRaid(true)}>+ 레이드 추가</button></div>{dayRaids.map((instance) => <RaidCard key={instance.id} instance={instance} catalog={catalog} roster={roster} day={selectedDay} onSlotClick={(instanceId, slotIndex) => setAssignment({ instanceId, slotIndex })} />)}</main>
      <aside className="summary-panel"><p className="summary-title">오늘의 편성 상태</p><div className="summary-number"><strong>{dayRaids.length}</strong><span>개 레이드</span></div><div className={`notice ${warningCount ? "has-warning" : ""}`}><strong>{warningCount ? `${warningCount}개 슬롯 확인 필요` : "편성 이상 없음"}</strong><p>{warningCount ? "멤버 불가 요일 또는 캐릭터 입장 레벨을 확인해주세요." : "모든 캐릭터가 참가 조건을 만족합니다."}</p></div><div className="legend"><span><i className="dot red" />불가/레벨 미달</span><span><i className="dot outline" />빈자리</span></div></aside>
    </div>
    {assignment && <AssignmentModal members={members} roster={roster} assignment={assignment} schedule={schedule} dayRaids={dayRaids} catalog={catalog} selectedDay={selectedDay} onAssign={assignCharacter} onClose={() => setAssignment(null)} />}
    {showAddRaid && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAddRaid(false)}><section className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{dayInfo.full} 일정</p><h3>레이드 추가</h3></div><button onClick={() => setShowAddRaid(false)}>닫기</button></div><div className="catalog-picker">{catalog.map((raid) => <button key={raid.id} onClick={() => addRaid(raid.id)}><span className={`catalog-color ${raid.color}`} style={{ background: getRaidColor(raid) }} /><span><strong>{raid.name} {raid.difficulty}</strong><small>{raid.size}인 · Lv. {raid.minLevel} · {formatNumber(raid.gold)} 골드</small></span></button>)}</div></section></div>}
  </>;
}

function RosterSyncModal({ member, onClose, onSave }) {
  const [characterName, setCharacterName] = useState(member.characters[0]?.name ?? member.representativeName ?? "");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const search = async (event) => {
    event.preventDefault(); setStatus("loading"); setMessage("");
    try {
      const response = await fetch(`/api/lostark/roster?characterName=${encodeURIComponent(characterName)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "조회에 실패했습니다.");
      setCharacters(body.characters); setSelectedIds(body.characters.slice(0, 6).map((character) => character.id)); setStatus("success");
    } catch (error) { setStatus("error"); setMessage(error.message); }
  };
  const toggleCharacter = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 6 ? [...current, id] : current);
  const saveSelected = () => onSave(characters.filter((character) => selectedIds.includes(character.id)));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal sync-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>{member.name} 멤버</p><h3>원정대 캐릭터 조회</h3></div><button onClick={onClose}>닫기</button></div><p className="modal-description">대표 캐릭터명 하나로 같은 원정대를 조회한 뒤, 실제 공대에 사용할 캐릭터를 최대 6개까지 선택해 저장합니다.</p><form className="lookup-form" onSubmit={search}><label>대표 캐릭터명<input required value={characterName} onChange={(event) => setCharacterName(event.target.value)} /></label><button className="primary" disabled={status === "loading"}>{status === "loading" ? "조회 중" : "API 조회"}</button></form>{status === "error" && <div className="api-error"><strong>연결 확인 필요</strong><span>{message}</span></div>}{status === "success" && <><div className="selection-count"><strong>{selectedIds.length}/6 선택</strong><span>캐릭터를 눌러 선택하거나 해제하세요.</span></div><div className="sync-result">{characters.map((character) => <button type="button" className={selectedIds.includes(character.id) ? "selected" : ""} aria-pressed={selectedIds.includes(character.id)} key={character.id} onClick={() => toggleCharacter(character.id)}><strong>{character.name}</strong><span>{character.className} · Lv. {character.itemLevel}</span><b>{character.role}</b></button>)}</div><button className="primary full" disabled={!selectedIds.length} onClick={saveSelected}>선택한 {selectedIds.length}개 캐릭터 저장</button></>}</section></div>;
}

function MemberAliasEditor({ member, onRename }) {
  const [value, setValue] = useState(member.name);
  const commit = () => {
    const nextName = value.trim();
    if (!nextName) { setValue(member.name); return; }
    if (nextName !== member.name) onRename(nextName);
  };
  return <div className="member-alias-editor"><label htmlFor={`alias-${member.id}`}>멤버 별명</label><div><input id={`alias-${member.id}`} value={value} onChange={(event) => setValue(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>{member.characters.length}/6 캐릭터 저장됨</span></div></div>;
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

function CharacterAssignmentSummary({ assignments }) {
  return <div className="member-character-usage">
    <div className={`member-character-count ${assignments.length >= 3 ? "full" : ""}`}><small>주간</small><strong>{assignments.length}/3</strong></div>
    <div className="member-assignment-chips">{assignments.length
      ? assignments.map((item) => <span className="member-assignment-chip" key={`${item.dayKey}-${item.instanceId}-${item.slotIndex}`}><b>{weekDays.find((day) => day.key === item.dayKey)?.label}</b>{item.raidName} {item.difficulty}</span>)
      : <span className="member-assignment-empty">배정된 레이드 없음</span>}
    </div>
  </div>;
}

function MemberRosterCard({ member, schedule, catalog, onRename, onColorChange, onToggleDay, onToggleActive, onSync, onToggleRole }) {
  return <article className={`member-roster-card ${member.active === false ? "inactive" : ""}`}>
    <div className="member-roster-head">
      <label className="member-color-picker" title="멤버 색상 변경" aria-label={`${member.name} 멤버 색상`}>
        <input type="color" value={member.color} onChange={(event) => onColorChange(event.target.value)} />
        <i style={{ background: member.color }} />
      </label>
      <MemberAliasEditor member={member} onRename={onRename} />
      <div className="unavailable-days"><small>고정 불가 요일</small><div>{weekDays.map((day) => <button key={day.key} className={member.unavailable.includes(day.key) ? "selected" : ""} onClick={() => onToggleDay(day.key)}>{day.label}</button>)}</div></div>
      <div className="member-actions"><button className={member.active === false ? "excluded" : "included"} onClick={onToggleActive}>{member.active === false ? "레이드 제외됨" : "레이드 참여"}</button><button className="refresh" onClick={onSync}>원정대 조회</button></div>
    </div>
    <div className="character-grid">{member.characters.map((character) => {
      const assignments = getCharacterAssignments(schedule, catalog, character.id);
      return <section key={character.id}><div><strong>{character.name}</strong><span>{character.className}</span></div><b>Lv. {character.itemLevel}</b><button className={character.role === "서폿" ? "support" : "dealer"} disabled={character.className !== "발키리"} title={character.className === "발키리" ? "딜러/서폿 전환" : "직업 고정 역할"} onClick={() => onToggleRole(character.id)}>{character.role}</button><CharacterAssignmentSummary assignments={assignments} /></section>;
    })}</div>
  </article>;
}

function MembersView({ members, setMembers, schedule, catalog }) {
  const [syncMemberId, setSyncMemberId] = useState(null);
  const toggleDay = (memberId, dayKey) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, unavailable: member.unavailable.includes(dayKey) ? member.unavailable.filter((day) => day !== dayKey) : [...member.unavailable, dayKey] } : member));
  const toggleRole = (memberId, characterId) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, characters: member.characters.map((character) => character.id === characterId && character.className === "발키리" ? { ...character, role: character.role === "서폿" ? "딜러" : "서폿" } : character) } : member));
  const toggleActive = (memberId) => setMembers((current) => current
    .map((member) => member.id === memberId ? { ...member, active: member.active === false } : member)
    .sort((left, right) => Number(left.active === false) - Number(right.active === false)));
  const renameMember = (memberId, name) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, name } : member));
  const changeMemberColor = (memberId, color) => setMembers((current) => current.map((member) => member.id === memberId ? { ...member, color } : member));
  const saveRoster = (characters) => { setMembers((current) => current.map((member) => member.id === syncMemberId ? { ...member, characters: characters.slice(0, 6) } : member)); setSyncMemberId(null); };
  const syncingMember = members.find((member) => member.id === syncMemberId);
  const activeMembers = members.filter((member) => member.active !== false);
  const inactiveMembers = members.filter((member) => member.active === false);
  const renderMember = (member) => <MemberRosterCard key={member.id} member={member} schedule={schedule} catalog={catalog} onRename={(name) => renameMember(member.id, name)} onColorChange={(color) => changeMemberColor(member.id, color)} onToggleDay={(dayKey) => toggleDay(member.id, dayKey)} onToggleActive={() => toggleActive(member.id)} onSync={() => setSyncMemberId(member.id)} onToggleRole={(characterId) => toggleRole(member.id, characterId)} />;
  return <section className="management-page"><div className="section-heading"><div><p>멤버 {activeMembers.length}명 활성 · 전체 {members.length}명</p><h2>멤버별 원정대 캐릭터</h2></div></div><div className="info-banner"><strong>고정 색상과 레이드 참여 상태 관리</strong><span>멤버 색상은 일정표와 동일하게 유지되며, 제외 멤버는 아래 접이식 목록으로 이동합니다.</span></div><div className="member-roster-list">{activeMembers.map(renderMember)}</div>{inactiveMembers.length > 0 && <details className="excluded-members"><summary>레이드 제외 멤버 {inactiveMembers.length}명</summary><div className="member-roster-list">{inactiveMembers.map(renderMember)}</div></details>}{syncingMember && <RosterSyncModal member={syncingMember} onClose={() => setSyncMemberId(null)} onSave={saveRoster} />}</section>;
}

function PersonalScheduleView({ members, schedule, catalog }) {
  const availableMembers = members.filter((member) => member.active !== false);
  const [myMemberId, setMyMemberId] = useState(() => localStorage.getItem("loa-my-member-id-v1") ?? availableMembers[0]?.id ?? "");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loa-my-character-ids-v1")) ?? []; }
    catch { return []; }
  });
  const myMember = members.find((member) => String(member.id) === String(myMemberId)) ?? availableMembers[0];
  const validSelectedIds = selectedCharacterIds.filter((id) => myMember?.characters.some((character) => character.id === id));
  const effectiveSelectedIds = validSelectedIds.length ? validSelectedIds : myMember?.characters.map((character) => character.id) ?? [];
  const selectedCharacters = myMember?.characters.filter((character) => effectiveSelectedIds.includes(character.id)) ?? [];
  useEffect(() => { if (myMember?.id) localStorage.setItem("loa-my-member-id-v1", String(myMember.id)); }, [myMember?.id]);
  useEffect(() => { localStorage.setItem("loa-my-character-ids-v1", JSON.stringify(effectiveSelectedIds)); }, [effectiveSelectedIds.join("|")]);
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
  return <section className="personal-page"><div className="section-heading"><div><p>내 캐릭터만 모아보기</p><h2>개인 주간 일정</h2></div></div><div className="personal-settings"><label>내 멤버 별명<select value={myMember?.id ?? ""} onChange={(event) => changeMember(event.target.value)}>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div><small>표시할 캐릭터</small><div className="my-character-chips">{myMember?.characters.map((character) => <button key={character.id} className={effectiveSelectedIds.includes(character.id) ? "selected" : ""} onClick={() => toggleCharacter(character.id)}><i style={{ background: myMember.color }} />{character.name}<span>{character.role}</span></button>)}</div></div></div><div className="personal-week">{weekDays.map((day) => { const entries = selectedCharacters.flatMap((character) => getCharacterAssignments(schedule, catalog, character.id).filter((item) => item.dayKey === day.key).map((item) => ({ ...item, character }))); return <article key={day.key} className={day.key === "sun" ? "sunday" : ""}><header><div><strong>{day.label}요일</strong><span>{day.date}</span></div>{myMember?.unavailable.includes(day.key) && <b>불참 요일</b>}</header><div>{entries.length ? entries.map((entry) => <section key={`${entry.character.id}-${entry.instanceId}-${entry.slotIndex}`} style={{ borderLeftColor: myMember.color }}><strong>{entry.character.name}</strong><span>{entry.raidName} {entry.difficulty}</span><small>{entry.character.role} · Lv. {entry.character.itemLevel}</small></section>) : <p>일정 없음</p>}</div></article>; })}</div></section>;
}

function RaidsView({ catalog, setCatalog }) {
  const [formOpen, setFormOpen] = useState(false);
  const emptyForm = { name: "", difficulty: "", minLevel: 1700, gold: 40000, size: 4, hexColor: raidColorDefaults.blue };
  const [form, setForm] = useState(emptyForm);
  const changeRaidColor = (raidId, hexColor) => setCatalog((current) => current.map((raid) => raid.id === raidId ? { ...raid, hexColor } : raid));
  const saveRaid = (event) => { event.preventDefault(); setCatalog((current) => [...current, { ...form, id: `${form.name}-${Date.now()}`, color: "blue", minLevel: Number(form.minLevel), gold: Number(form.gold), size: Number(form.size) }]); setFormOpen(false); setForm(emptyForm); };
  return <section className="management-page"><div className="section-heading"><div><p>레이드 조건 직접 관리</p><h2>레이드 목록</h2></div><button className="primary" onClick={() => setFormOpen(true)}>+ 새 레이드</button></div><div className="info-banner"><strong>획득 골드와 입장 레벨 등록</strong><span>색상은 주간 일정 레이드 제목에 동일하게 적용되고 자동 저장됩니다.</span></div><div className="raid-rule-list"><div className="rule-head"><span>레이드 · 색상</span><span>인원</span><span>입장 레벨</span><span>획득 골드</span></div>{catalog.map((raid) => <article key={raid.id}><div><label className="raid-color-picker" aria-label={`${raid.name} ${raid.difficulty} 색상`} title="레이드 색상 변경"><input type="color" value={getRaidColor(raid)} onChange={(event) => changeRaidColor(raid.id, event.target.value)} /><i style={{ background: getRaidColor(raid) }} /></label><strong>{raid.name}</strong><span>{raid.difficulty}</span></div><b>{raid.size}인</b><b>Lv. {raid.minLevel}</b><b>{formatNumber(raid.gold)}</b></article>)}</div>{formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setFormOpen(false)}><form className="modal raid-form" onSubmit={saveRaid} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p>관리자 등록</p><h3>새 레이드 조건</h3></div><button type="button" onClick={() => setFormOpen(false)}>닫기</button></div><label>레이드명<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="예: 세르카" /></label><label>난이도<input required value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} placeholder="예: 하드" /></label><div className="form-row"><label>입장 아이템 레벨<input type="number" value={form.minLevel} onChange={(event) => setForm({ ...form, minLevel: event.target.value })} /></label><label>획득 골드<input type="number" value={form.gold} onChange={(event) => setForm({ ...form, gold: event.target.value })} /></label></div><div className="form-row"><label>공대 인원<select value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })}><option value="4">4인</option><option value="8">8인</option></select></label><label>레이드 색상<input className="raid-form-color" type="color" value={form.hexColor} onChange={(event) => setForm({ ...form, hexColor: event.target.value })} /></label></div><button className="primary full" type="submit">레이드 저장</button></form></div>}</section>;
}

export function App() {
  const [activeTab, setActiveTab] = useState("schedule");
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
  const [schedule, setSchedule] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loa-raid-schedule-v1")) ?? initialSchedule; }
    catch { return initialSchedule; }
  });
  const [isDirty, setIsDirty] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(supabase ? "connecting" : "offline");
  const [cloudMessage, setCloudMessage] = useState("");
  const cloudReadyRef = useRef(false);
  const lastSyncedFingerprintRef = useRef("");
  const savedStateRef = useRef({ members, catalog, schedule });

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;
    let channel;
    const applyCloudState = (row) => {
      const nextState = {
        members: normalizeMembers(row.members ?? initialGuildMembers),
        catalog: normalizeCatalog(row.catalog ?? initialCatalog),
        schedule: row.schedule ?? initialSchedule,
      };
      lastSyncedFingerprintRef.current = cloudFingerprint(nextState);
      savedStateRef.current = nextState;
      setMembers(nextState.members);
      setCatalog(nextState.catalog);
      setSchedule(nextState.schedule);
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
        const initialState = { members, catalog, schedule };
        const { error: createError } = await supabase.from("raid_board_state").upsert({ id: "guild-main", ...initialState, updated_at: new Date().toISOString() });
        if (cancelled) return;
        if (createError) {
          setCloudStatus("error");
          setCloudMessage(createError.message);
          return;
        }
        lastSyncedFingerprintRef.current = cloudFingerprint(initialState);
      }
      cloudReadyRef.current = true;
      setCloudStatus("connected");
      setCloudMessage("");
      channel = supabase.channel("raid-board-state")
        .on("postgres_changes", { event: "*", schema: "public", table: "raid_board_state", filter: "id=eq.guild-main" }, (payload) => {
          if (payload.new?.members) applyCloudState(payload.new);
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

  const updateMembers = (value) => { setIsDirty(true); setMembers(value); };
  const updateCatalog = (value) => { setIsDirty(true); setCatalog(value); };
  const updateSchedule = (value) => { setIsDirty(true); setSchedule(value); };
  const cancelChanges = () => {
    const saved = savedStateRef.current;
    setMembers(saved.members);
    setCatalog(saved.catalog);
    setSchedule(saved.schedule);
    setIsDirty(false);
  };
  const saveChanges = async () => {
    const state = { members, catalog, schedule };
    if (supabase && !cloudReadyRef.current) {
      setCloudMessage("공용 DB 연결이 끝난 뒤 저장해주세요.");
      return;
    }
    if (supabase) {
      setCloudStatus("saving");
      const { error } = await supabase.from("raid_board_state").upsert({ id: "guild-main", ...state, updated_at: new Date().toISOString() });
      if (error) {
        setCloudStatus("error");
        setCloudMessage(error.message);
        return;
      }
      lastSyncedFingerprintRef.current = cloudFingerprint(state);
      setCloudStatus("connected");
      setCloudMessage("");
    }
    localStorage.setItem("loa-raid-members-v2", JSON.stringify(state.members));
    localStorage.setItem("loa-raid-catalog-v1", JSON.stringify(state.catalog));
    localStorage.setItem("loa-raid-schedule-v1", JSON.stringify(state.schedule));
    savedStateRef.current = state;
    setIsDirty(false);
  };

  const cloudText = { connecting: "공용 DB 연결 중", connected: "공용 DB 연결됨", saving: "공용 일정 저장 중", error: "공용 DB 설정 필요", offline: "브라우저에만 저장 중" }[cloudStatus];
  return <div className="app-shell"><AppHeader activeTab={activeTab} setActiveTab={setActiveTab} /><div className={`cloud-status ${cloudStatus}`} title={cloudMessage}><i /><span>{cloudText}</span>{cloudMessage && <small>{cloudMessage}</small>}<a href="https://supabase.com/dashboard/project/srdooyseixgxljsdmecc" target="_blank" rel="noreferrer">DB 관리</a></div><div className="page-wrap">{activeTab === "schedule" && <ScheduleView members={members} catalog={catalog} schedule={schedule} setSchedule={updateSchedule} />}{activeTab === "personal" && <PersonalScheduleView members={members} schedule={schedule} catalog={catalog} />}{activeTab === "members" && <MembersView members={members} setMembers={updateMembers} schedule={schedule} catalog={catalog} />}{activeTab === "raids" && <RaidsView catalog={catalog} setCatalog={updateCatalog} />}<SaveChangesBar isDirty={isDirty} onCancel={cancelChanges} onSave={saveChanges} /></div></div>;
}
