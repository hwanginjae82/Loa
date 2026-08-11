export function migrateRosterSchedule({ previousCharacters, refreshedCharacters, schedule }) {
  const nameByPreviousReference = new Map(previousCharacters.flatMap((character) => [
    [character.id, character.name],
    [character.name, character.name],
  ]));
  const refreshedNames = new Set(refreshedCharacters.map((character) => character.name));
  const missingAssignedNames = new Set();

  for (const raids of Object.values(schedule)) {
    for (const raid of raids) {
      for (const characterReference of raid.characterIds) {
        const name = nameByPreviousReference.get(characterReference);
        if (name && !refreshedNames.has(name)) missingAssignedNames.add(name);
      }
    }
  }

  if (missingAssignedNames.size) {
    return { schedule, missingAssignedNames: [...missingAssignedNames] };
  }

  const migratedSchedule = Object.fromEntries(Object.entries(schedule).map(([day, raids]) => [day, raids.map((raid) => ({
    ...raid,
    characterIds: raid.characterIds.map((characterReference) => {
      const name = nameByPreviousReference.get(characterReference);
      return name && refreshedNames.has(name) ? name : characterReference;
    }),
  }))]));

  return { schedule: migratedSchedule, missingAssignedNames: [] };
}
