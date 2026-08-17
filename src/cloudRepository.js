const boardTables = ["raid_members", "raid_characters", "raid_catalog", "raid_board_weeks"];

const serialize = (value) => JSON.stringify(value);

const diffRows = (previousRows, currentRows, key) => {
  const previousByKey = new Map(previousRows.map((row) => [String(row[key]), row]));
  const currentByKey = new Map(currentRows.map((row) => [String(row[key]), row]));
  return {
    upsert: currentRows.filter((row) => serialize(previousByKey.get(String(row[key]))) !== serialize(row)),
    delete: previousRows.filter((row) => !currentByKey.has(String(row[key]))).map((row) => String(row[key])),
  };
};

export const membersToRows = (members) => members.map((member, index) => ({
  id: String(member.id),
  name: member.name,
  representative_name: member.representativeName ?? null,
  color: member.color,
  active: member.active !== false,
  sort_order: index,
}));

export const charactersToRows = (members) => members.flatMap((member) => member.characters.map((character, index) => ({
  character_key: String(character.id ?? character.name),
  member_id: String(member.id),
  name: character.name,
  server_name: character.serverName ?? null,
  class_name: character.className,
  role: character.role,
  item_level: Number(character.itemLevel) || 0,
  combat_power: character.combatPower == null ? null : Number(character.combatPower),
  earns_gold: character.earnsGold !== false,
  sort_order: index,
})));

export const catalogToRows = (catalog) => catalog.map((raid, index) => ({
  id: String(raid.id),
  name: raid.name,
  difficulty: raid.difficulty,
  party_size: Number(raid.size),
  min_level: Number(raid.minLevel),
  gold: Number(raid.gold),
  color: raid.color ?? null,
  hex_color: raid.hexColor ?? null,
  sort_order: index,
}));

export const weeksToRows = (schedule) => Object.entries(schedule?.weeks ?? {}).map(([weekStart, week]) => ({
  week_start: weekStart,
  raids: week.raids ?? {},
  unavailable_by_member: week.unavailableByMember ?? {},
}));

export const rowsToMembers = (memberRows, characterRows) => {
  const charactersByMember = new Map();
  characterRows.forEach((row) => {
    const characters = charactersByMember.get(String(row.member_id)) ?? [];
    characters.push({
      id: row.character_key,
      name: row.name,
      ...(row.server_name == null ? {} : { serverName: row.server_name }),
      className: row.class_name,
      role: row.role,
      itemLevel: Number(row.item_level),
      ...(row.combat_power == null ? {} : { combatPower: Number(row.combat_power) }),
      earnsGold: row.earns_gold !== false,
    });
    charactersByMember.set(String(row.member_id), characters);
  });
  return memberRows.map((row) => ({
    id: row.id,
    name: row.name,
    ...(row.representative_name == null ? {} : { representativeName: row.representative_name }),
    color: row.color,
    active: row.active !== false,
    characters: charactersByMember.get(String(row.id)) ?? [],
  }));
};

export const rowsToCatalog = (rows) => rows.map((row) => ({
  id: row.id,
  name: row.name,
  difficulty: row.difficulty,
  size: Number(row.party_size),
  minLevel: Number(row.min_level),
  gold: Number(row.gold),
  ...(row.color == null ? {} : { color: row.color }),
  ...(row.hex_color == null ? {} : { hexColor: row.hex_color }),
}));

export const rowsToSchedule = (rows) => ({
  version: 2,
  weeks: Object.fromEntries(rows.map((row) => [row.week_start, {
    raids: row.raids ?? {},
    unavailableByMember: row.unavailable_by_member ?? {},
  }])),
});

export function buildBoardChanges(previous, current, dirtyFields) {
  const changes = {};
  if (dirtyFields.has("members")) {
    changes.members = diffRows(membersToRows(previous.members), membersToRows(current.members), "id");
    changes.characters = diffRows(charactersToRows(previous.members), charactersToRows(current.members), "character_key");
  }
  if (dirtyFields.has("catalog")) changes.catalog = diffRows(catalogToRows(previous.catalog), catalogToRows(current.catalog), "id");
  if (dirtyFields.has("schedule")) changes.weeks = diffRows(weeksToRows(previous.schedule), weeksToRows(current.schedule), "week_start");
  return Object.fromEntries(Object.entries(changes).filter(([, change]) => change.upsert.length || change.delete.length));
}

export async function loadCloudBoard(supabase, { earliestWeekStart, latestWeekStart }) {
  const requests = [
    supabase.from("raid_members").select("id,name,representative_name,color,active,sort_order").order("sort_order"),
    supabase.from("raid_characters").select("character_key,member_id,name,server_name,class_name,role,item_level,combat_power,earns_gold,sort_order").order("sort_order"),
    supabase.from("raid_catalog").select("id,name,difficulty,party_size,min_level,gold,color,hex_color,sort_order").order("sort_order"),
    supabase.from("raid_board_weeks").select("week_start,raids,unavailable_by_member").gte("week_start", earliestWeekStart).lte("week_start", latestWeekStart).order("week_start"),
  ];
  const results = await Promise.all(requests);
  const failedIndex = results.findIndex((result) => result.error);
  if (failedIndex >= 0) {
    const error = new Error(`${boardTables[failedIndex]}: ${results[failedIndex].error.message}`);
    error.code = results[failedIndex].error.code;
    throw error;
  }
  return {
    members: rowsToMembers(results[0].data ?? [], results[1].data ?? []),
    catalog: rowsToCatalog(results[2].data ?? []),
    schedule: rowsToSchedule(results[3].data ?? []),
  };
}

export async function saveCloudBoardChanges(supabase, changes) {
  if (!Object.keys(changes).length) return;
  const { error } = await supabase.rpc("save_raid_board_changes", { p_changes: changes });
  if (error) throw error;
}

export const realtimeBoardTables = boardTables;
