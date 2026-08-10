export function recoverLegacySchedule({ schedule, members, prefixToMemberName }) {
  const recovered = structuredClone(schedule);
  const currentIds = new Set(
    members.flatMap((member) => member.characters.map((character) => character.id)),
  );
  const mappedByOldId = new Map();
  const unresolved = new Set();

  const resolveCharacterId = (characterId) => {
    if (!characterId || currentIds.has(characterId)) return characterId;
    if (mappedByOldId.has(characterId)) return mappedByOldId.get(characterId);

    const match = /^([a-z])(\d+)$/.exec(characterId);
    const memberName = match ? prefixToMemberName[match[1]] : undefined;
    const matchingMembers = memberName
      ? members.filter((member) => member.name === memberName)
      : [];
    const character = matchingMembers.length === 1
      ? matchingMembers[0].characters[Number(match[2]) - 1]
      : undefined;

    if (!character?.id) {
      unresolved.add(characterId);
      return characterId;
    }

    mappedByOldId.set(characterId, character.id);
    return character.id;
  };

  for (const week of Object.values(recovered.weeks ?? {})) {
    for (const raids of Object.values(week.raids ?? {})) {
      for (const raid of raids ?? []) {
        raid.characterIds = (raid.characterIds ?? []).map(resolveCharacterId);
      }
    }
  }

  return {
    schedule: recovered,
    mappings: [...mappedByOldId]
      .map(([oldId, newId]) => ({ oldId, newId }))
      .sort((left, right) => left.oldId.localeCompare(right.oldId)),
    unresolved: [...unresolved].sort(),
  };
}
