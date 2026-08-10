import "./saveChangesBar.css";

export function SaveChangesBar({ isDirty, isSaving = false, onCancel, onSave }) {
  if (!isDirty) return null;

  return (
    <div className="save-changes-bar" role="status">
      <span className="save-changes-bar__message">저장하지 않은 수정 있음</span>
      <div className="save-changes-bar__actions">
        <button type="button" onClick={onCancel} disabled={isSaving}>
          취소
        </button>
        <button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "저장 중..." : "공용 일정에 저장"}
        </button>
      </div>
    </div>
  );
}
