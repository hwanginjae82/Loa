export function migrateRosterSchedule({ previousCharacters, refreshedCharacters, schedule }) {
  const nameByPreviousId = new Map(previousCharacters.map((character) => [character.id, character.name]));
  const refreshedIdByName = new Map(refreshedCharacters.map((character) => [character.name, character.id]));
  const missingAssignedNames = new Set();

  for (const raids of Object.values(schedule)) {
    for (const raid of raids) {
      for (const characterId of raid.characterIds) {
        const name = nameByPreviousId.get(characterId);
        if (name && !refreshedIdByName.has(name)) missingAssignedNames.add(name);
      }
    }
  }

  if (missingAssignedNames.size) {
    return { schedule, missingAssignedNames: [...missingAssignedNames] };
  }

  const migratedSchedule = Object.fromEntries(Object.entries(schedule).map(([day, raids]) => [day, raids.map((raid) => ({
    ...raid,
    characterIds: raid.characterIds.map((characterId) => {
      const name = nameByPreviousId.get(characterId);
      return name ? refreshedIdByName.get(name) : characterId;
    }),
  }))]));

  return { schedule: migratedSchedule, missingAssignedNames: [] };
}
