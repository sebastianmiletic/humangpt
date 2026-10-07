import { protectedTermsError, SMARTNESS_HELP, SMARTNESS_LABELS, SMARTNESS_LEVELS, VOCABULARIES, VOCABULARY_HELP, VOCABULARY_LABELS, type Engine, type RewriteSettings } from '../shared/settings';
import { TONES, TONE_LABELS } from '../shared/text';

interface Props {
  engine: Engine;
  settings: RewriteSettings;
  protectedInput: string;
  busy: boolean;
  onEngineChange: (engine: Engine) => void;
  onChange: (settings: Partial<RewriteSettings>) => void;
  onProtectedChange: (value: string) => void;
}

export function SettingsControls({ engine, settings, protectedInput, busy, onEngineChange, onChange, onProtectedChange }: Props) {
  const termsError = protectedTermsError(settings.protectedTerms);
  return <>
    <div className="editor-toolbar">
      <fieldset className="tone-fieldset" disabled={busy}>
        <legend>Writing tone</legend>
        <div className="tone-options">{TONES.map((tone) => <label className={`tone-option ${settings.tone === tone ? 'selected' : ''}`} key={tone}>
          <input className="tone-input" type="radio" name="tone" value={tone} checked={settings.tone === tone} onChange={() => onChange({ tone, ...(tone === 'professional' ? { contractions: false } : {}) })} />
          {TONE_LABELS[tone]}
        </label>)}</div>
      </fieldset>
      <label className="engine-control"><span>Processing</span><select value={engine} disabled={busy} onChange={(event) => onEngineChange(event.target.value as Engine)}>
        <option value="local">Local · no API</option><option value="cloud">Cloud AI · optional</option>
      </select></label>
    </div>
    <div className="settings-row">
      <fieldset className="smartness-fieldset" disabled={busy}>
        <legend>Smartness</legend>
        <div className="smartness-options">{SMARTNESS_LEVELS.map((smartness) => <label title={SMARTNESS_HELP[smartness]} className={`tone-option ${settings.smartness === smartness ? 'selected' : ''}`} key={smartness}>
          <input className="tone-input" type="radio" name="smartness" value={smartness} checked={settings.smartness === smartness} onChange={() => onChange({ smartness })} />
          {SMARTNESS_LABELS[smartness]}
        </label>)}</div>
        <p className="control-help">{SMARTNESS_HELP[settings.smartness]} Levels change edit intensity, not model intelligence.</p>
      </fieldset>
      <label className="setting-field"><span>Vocabulary</span><select value={settings.vocabulary} disabled={busy} aria-describedby="vocabulary-help" onChange={(event) => onChange({ vocabulary: event.target.value as RewriteSettings['vocabulary'] })}>
        {VOCABULARIES.map((vocabulary) => <option value={vocabulary} key={vocabulary}>{VOCABULARY_LABELS[vocabulary]}</option>)}
      </select><span id="vocabulary-help" className="control-help">{VOCABULARY_HELP[settings.vocabulary]}</span></label>
    </div>
    <details className="advanced-settings">
      <summary>Fine-tune your rewrite</summary>
      <fieldset className="advanced-fields" disabled={busy}>
        <legend className="sr-only">Additional writing preferences</legend>
        <label className="setting-field"><span>Length</span><select value={settings.length} onChange={(event) => onChange({ length: event.target.value as RewriteSettings['length'] })}>
          <option value="preserve">Keep the details</option><option value="concise">More concise</option>
        </select><span className="control-help">Concision removes redundant wording, not your facts.</span></label>
        <div className="checkbox-settings">
          <label><input type="checkbox" checked={settings.contractions} disabled={settings.tone === 'professional'} onChange={(event) => onChange({ contractions: event.target.checked })} />Allow contractions</label>
          <span className="control-help">{settings.tone === 'professional' ? 'Professional tone uses full forms.' : 'For example, “do not” can become “don’t”.'}</span>
          <label><input type="checkbox" checked={settings.sentenceVariety} onChange={(event) => onChange({ sentenceVariety: event.target.checked })} />Vary sentence structure</label>
          <span className="control-help">Local mode only splits suitable long sentences at High.</span>
        </div>
        <label className="setting-field protected-setting"><span>Protected words or phrases</span><input type="text" value={protectedInput} spellCheck={false} autoCorrect="off" autoCapitalize="off" maxLength={2_000} aria-invalid={Boolean(termsError)} aria-describedby="protected-help editor-feedback" placeholder="Brand names, technical terms, exact phrases" onChange={(event) => onProtectedChange(event.target.value)} /><span id="protected-help" className="control-help">Comma-separated, up to 20. Not saved with your preferences.</span></label>
      </fieldset>
    </details>
  </>;
}
