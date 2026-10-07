import type { LocalResult } from '../shared/local/engine';
import type { TextAnalysis } from '../shared/local/analysis';
import { SMARTNESS_LABELS, type Engine, type ResolvedSmartness } from '../shared/settings';

export interface RevisionMeta {
  engine: Engine;
  level: ResolvedSmartness;
  before: TextAnalysis;
  after: TextAnalysis;
  local?: LocalResult;
}

export function RevisionReview({ meta }: { meta: RevisionMeta }) {
  const { local, before, after } = meta;
  return <details className="revision-review">
    <summary>{local ? `Review ${local.editCount} local ${local.editCount === 1 ? 'edit' : 'edits'}` : 'Review your cloud rewrite'}<span className="review-level">{SMARTNESS_LABELS[meta.level]} intensity</span></summary>
    <div className="revision-content">
      {local && <p className="revision-reason">{local.adaptiveReason}</p>}
      <dl className="reading-metrics">
        <div><dt>Words</dt><dd>{before.words} → {after.words}</dd></div>
        <div><dt>Long sentences</dt><dd>{before.longSentences} → {after.longSentences}</dd></div>
        <div><dt>Reading ease, estimated</dt><dd>{before.readingLabel} → {after.readingLabel}</dd></div>
      </dl>
      <p className="metrics-note">Reading ease uses a rough English Flesch estimate, not an AI detector or a measure of factual accuracy.</p>
      {local?.changes.length ? <ol className="edits-list">{local.changes.map((change, index) => <li key={index}>
        <div><span className="edit-before">{change.before.trim() || '(extra spacing)'}</span><span aria-hidden="true"> → </span><span className="sr-only"> changed to </span><span>{change.after.trim() || '(removed)'}</span>{change.count > 1 && <span className="edit-count"> ×{change.count}</span>}</div>
        <p>{change.reason}</p>
      </li>)}</ol> : <p className="revision-reason">{local ? local.notice : 'Cloud AI can restructure the draft. Review facts, qualifications, protected phrases, and citations before using it.'}</p>}
    </div>
  </details>;
}
