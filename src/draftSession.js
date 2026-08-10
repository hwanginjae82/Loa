const fingerprint = (value) => JSON.stringify(value);

export function beginDraft(saved) {
  return { saved, draft: saved, isDirty: false };
}

export function updateDraft(session, draft) {
  return {
    ...session,
    draft,
    isDirty: fingerprint(session.saved) !== fingerprint(draft),
  };
}

export function cancelDraft(session) {
  return { saved: session.saved, draft: session.saved, isDirty: false };
}

export function saveDraft(session) {
  return { saved: session.draft, draft: session.draft, isDirty: false };
}
