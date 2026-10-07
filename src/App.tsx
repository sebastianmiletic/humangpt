import { useEffect, useRef, useState, type FormEvent } from 'react';
import { countWords, MAX_CHARACTERS, MAX_WORDS, TONE_LABELS, type ApiErrorBody } from '../shared/text';
import { parseProtectedTerms, protectedTermsError, SMARTNESS_LABELS, type RewriteSettings } from '../shared/settings';
import { analyzeText, resolveSmartness } from '../shared/local/analysis';
import { Icon } from './Icons';
import { SettingsControls } from './RewriteSettings';
import { RevisionReview, type RevisionMeta } from './RevisionReview';
import { readPreferences, savePreferences } from './preferences';
import { runLocal } from './local/client';
import { useOfflineApp } from './useOfflineApp';

const EXAMPLE = 'It is important to note that our team utilizes this guide in order to communicate clearly. We review the draft on a regular basis, and we make use of specific examples for the purpose of helping readers follow the argument. In the event that a sentence feels stiff, we take into consideration a simpler alternative. The results may vary, so each writer should review the final text before sharing it.';
const GITHUB_URL = 'https://github.com/sebastianmiletic/humangpt';

export default function App() {
  const [preferences, setPreferences] = useState(readPreferences);
  const { engine, settings } = preferences;
  const [protectedInput, setProtectedInput] = useState('');
  const [draft, setDraft] = useState('');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState<RevisionMeta | null>(null);
  const [lastSignature, setLastSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const outputSectionRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offline = useOfflineApp();
  const signature = JSON.stringify({ draft, engine, settings });
  const words = countWords(draft);
  const limitError = words > MAX_WORDS ? `Keep your draft under ${MAX_WORDS.toLocaleString()} words. Try one section at a time.`
    : draft.length > MAX_CHARACTERS ? `Keep your draft under ${MAX_CHARACTERS.toLocaleString()} characters. Try a shorter section.`
      : protectedTermsError(settings.protectedTerms);
  const stale = Boolean(output && lastSignature !== signature);
  const cloudDisabled = engine === 'cloud' && (configured === false || !offline.online);

  useEffect(() => { savePreferences(preferences); }, [preferences]);
  useEffect(() => {
    setConfigured(null);
    if (engine !== 'cloud' || !offline.online) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'configured' in data && typeof data.configured === 'boolean') setConfigured(data.configured);
      }).catch(() => { /* Cloud errors are handled by the rewrite request. Local mode needs no health check. */ })
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [engine, offline.online]);
  useEffect(() => () => {
    controllerRef.current?.abort();
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  function changeSettings(patch: Partial<RewriteSettings>) {
    setPreferences((previous) => ({ ...previous, settings: { ...previous.settings, ...patch } }));
    setCopied(false);
    setError('');
  }
  function useLocal() {
    setPreferences((previous) => ({ ...previous, engine: 'local' }));
    setError('');
  }

  async function rewrite(event?: FormEvent) {
    event?.preventDefault();
    if (controllerRef.current || !draft.trim() || limitError || cloudDisabled) return;
    const submitted = { draft, engine, settings, signature };
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 70_000);
    setBusy(true); setError(''); setCopied(false);
    setNotice(engine === 'local' ? 'Editing locally. Your draft stays in this browser.' : 'Rewriting your draft in the cloud.');
    try {
      let text: string;
      let resultMeta: RevisionMeta;
      if (submitted.engine === 'local') {
        const result = await runLocal(submitted.draft, submitted.settings, controller.signal);
        text = result.text;
        resultMeta = { engine: 'local', level: result.level, before: result.before, after: result.after, local: result };
      } else {
        const response = await fetch('/api/humanize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: submitted.draft, ...submitted.settings }), signal: controller.signal,
        });
        const data: unknown = await response.json().catch(() => null);
        controller.signal.throwIfAborted();
        if (!response.ok) {
          const apiError = data as ApiErrorBody | null;
          throw new Error(apiError?.error?.message || 'Could not rewrite your draft. Please try again.');
        }
        if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string' || !data.text.trim()) throw new Error('The server did not return a rewrite. Please try again.');
        text = data.text;
        resultMeta = { engine: 'cloud', level: resolveSmartness(submitted.draft, submitted.settings).level, before: analyzeText(submitted.draft), after: analyzeText(text) };
      }
      controller.signal.throwIfAborted();
      setOutput(text); setMeta(resultMeta); setLastSignature(submitted.signature);
      setNotice(resultMeta.local?.notice ?? 'Your rewrite is ready. Review it before using it.');
      if (window.matchMedia('(max-width: 760px)').matches) outputSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (failure) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') setNotice('Rewrite canceled.');
      else {
        setError(controller.signal.reason === 'timeout' ? 'The rewrite took too long. Try a shorter section, or use local mode.'
          : failure instanceof TypeError ? 'Could not connect. Check your connection, or switch to local mode.'
            : failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
        setNotice('');
      }
    } finally {
      clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
    }
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true); setNotice('Rewrite copied to your clipboard.');
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2_500);
    } catch {
      outputRef.current?.focus(); outputRef.current?.select();
      setNotice('Text selected. Press Ctrl+C or Command+C to copy.');
    }
  }
  function downloadOutput() {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'humangpt-rewrite.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice('Your rewrite has been downloaded.');
  }
  function clearDraft() {
    setDraft(''); setOutput(''); setMeta(null); setLastSignature(''); setError(''); setCopied(false);
    setNotice('Draft cleared.'); sourceRef.current?.focus();
  }

  return <>
    <a className="skip-link" href="#draft-text">Skip to editor</a>
    <header className="site-header">
      <a href="/" className="wordmark" aria-label="HumanGPT home"><svg className="brand-mark" width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="currentColor" /><path d="M12 10v20m0-8c0-10 16-10 16 0v8" fill="none" stroke="var(--color-on-accent)" strokeWidth="3.5" strokeLinecap="round" /></svg><span>human<span className="wordmark-light">gpt</span></span></a>
      <a className="github-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Icon name="github" /><span>Open source</span><span className="sr-only"> on GitHub (opens in a new tab)</span></a>
    </header>
    <main className="app-shell">
      <div className="intro"><p className="eyebrow">Your words, a little clearer</p><h1>Make it sound like you.</h1><p className="intro-copy">Polish your draft right in your browser, even offline. Choose how much to change, without losing what you want to say.</p></div>
      {engine === 'cloud' && (configured === false || !offline.online) && <div className="configuration-notice" role="status"><Icon name="info" /><div><strong>{!offline.online ? 'You’re offline.' : 'Cloud mode needs an API key.'}</strong> {!offline.online ? 'Switch to local mode to keep editing without a connection.' : 'Add OPENAI_API_KEY on the server for cloud rewriting, or use the local editor for free.'}<button type="button" className="text-button local-switch" onClick={useLocal}>Use local mode</button></div></div>}
      <form onSubmit={rewrite} aria-label="Text humanizer" autoComplete="off">
        <SettingsControls engine={engine} settings={settings} protectedInput={protectedInput} busy={busy} onEngineChange={(next) => { setPreferences((previous) => ({ ...previous, engine: next })); setError(''); setCopied(false); }} onChange={changeSettings} onProtectedChange={(value) => { setProtectedInput(value); changeSettings({ protectedTerms: parseProtectedTerms(value) }); }} />
        <p className="processing-note">{engine === 'local' ? `${offline.online ? 'Local mode' : 'Offline local mode'}: English-focused edits. Your text stays in this browser.` : 'Cloud AI: your draft is sent to the configured provider. Internet and an API key are required.'}</p>
        <div className="workspace">
          <section className="editor-panel source-panel" aria-labelledby="source-heading">
            <div className="panel-heading"><h2 id="source-heading"><label htmlFor="draft-text">Your draft</label></h2>{draft ? <button type="button" className="text-button" disabled={busy} onClick={clearDraft}>Clear</button> : <button type="button" className="text-button" disabled={busy} onClick={() => { setDraft(EXAMPLE); setError(''); setNotice('Example loaded. Choose your settings and humanize it.'); sourceRef.current?.focus(); }}>Try an example</button>}</div>
            <textarea id="draft-text" ref={sourceRef} value={draft} onChange={(event) => { setDraft(event.target.value); setError(''); setNotice(''); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void rewrite(); } }} readOnly={busy} placeholder="Paste your text here. A paragraph, an email, a first draft…" aria-describedby="draft-limit editor-feedback" aria-invalid={words > MAX_WORDS || draft.length > MAX_CHARACTERS} spellCheck={false} autoCorrect="off" autoCapitalize="off" />
            <div className="panel-footer"><div className="draft-count" id="draft-limit"><span className={limitError ? 'invalid-count' : ''}>{words.toLocaleString()} <span className="muted">/ {MAX_WORDS.toLocaleString()} words</span></span><span className="character-count">{draft.length.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} characters</span><span className="keyboard-hint">Ctrl / ⌘ + Enter</span></div>{busy ? <button key="cancel" type="button" className="button button-secondary" onClick={(event) => { event.preventDefault(); controllerRef.current?.abort(); }}><Icon name="close" />Cancel</button> : <button key="rewrite" type="submit" className="button button-primary" disabled={!draft.trim() || Boolean(limitError) || cloudDisabled}>{output ? 'Rewrite again' : 'Humanize text'}<Icon name="arrow" /></button>}</div>
          </section>
          <section className="editor-panel result-panel" aria-labelledby="result-heading" ref={outputSectionRef}>
            <div className="panel-heading"><h2 id="result-heading">Your rewrite</h2><span className="result-tone">{meta && !busy ? `${meta.engine === 'local' ? 'Local' : 'Cloud'} · ${SMARTNESS_LABELS[meta.level]}` : TONE_LABELS[settings.tone]}</span></div>
            <div className="result-content" aria-busy={busy}>{busy ? <div className="loading-state"><p>{engine === 'local' ? 'Editing on your device…' : 'Finding the right words…'}</p><div className="skeleton-lines" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div><p className="loading-note">{engine === 'local' ? 'No network request. No API key.' : 'Good writing takes a moment.'}</p></div> : output ? <textarea id="output-text" ref={outputRef} readOnly value={output} aria-label="Rewritten text" spellCheck={false} /> : <div className="empty-state"><span className="empty-icon"><Icon name="pen" width="25" height="25" /></span><p>A fresh take on your words.</p><span>Your rewrite will appear here.<br />Still your ideas, just a little clearer.</span></div>}</div>
            <div className="panel-footer result-footer"><span className="output-count">{countWords(output).toLocaleString()} <span className="muted">words</span></span><div className="output-actions"><button type="button" className="icon-button" aria-label="Download rewrite" title="Download as text" disabled={!output || busy} onClick={downloadOutput}><Icon name="download" /></button><button type="button" className="button button-copy" disabled={!output || busy} onClick={() => void copyOutput()}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy text'}</button></div></div>
          </section>
        </div>
        <div id="editor-feedback" className="editor-feedback">{limitError || error ? <p className="error-message" role="alert"><Icon name="info" />{limitError || error}{engine === 'cloud' && error && <button type="button" className="text-button" onClick={useLocal}>Use local mode instead</button>}</p> : stale ? <p className="stale-message">Your draft or settings have changed. Rewrite again to refresh the result.</p> : meta?.local?.editCount === 0 ? <p className="review-note"><Icon name="info" />{meta.local.notice}</p> : <p className="review-note"><Icon name="check" />Your meaning matters. Give the rewrite a quick review before using it.</p>}</div>
        {meta && !busy && <RevisionReview meta={meta} />}
        <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      </form>
      <div className="fine-print"><Icon name="info" /><p>Local mode uses careful editing rules and a small learned ranker, not a full language model. No tool can guarantee “0% AI” or passing an AI checker.</p></div>
    </main>
    <footer className="site-footer">
      <div className="footer-status"><span className="footer-tagline">A little polish. A lot more you.</span><span className="offline-status" role="status">{offline.offlineReady ? 'Offline ready' : offline.cacheError ? 'Offline cache unavailable. Local editing still works while this page is open.' : import.meta.env.PROD ? 'Preparing offline cache…' : 'Local mode needs no API key'}</span>{offline.canInstall && <button type="button" className="text-button" onClick={() => void offline.install()}>Install app</button>}{offline.updateAvailable && <div className="update-notice"><button type="button" className="text-button" disabled={busy} onClick={offline.update}>Reload for update</button><span>Copy unsaved text first.</span></div>}</div>
      <div className="footer-details"><details><summary>How it works</summary><p>Paste a draft, choose tone, smartness, and vocabulary, then rewrite. Adaptive picks an edit intensity from the wording and sentence length. Local mode ranks conservative English edits with a small trained model. Cloud AI can make deeper changes.</p></details><details><summary>Privacy & offline</summary><p>Local mode never sends your draft to a server. Only style preferences are saved, not drafts, rewrites, or protected phrases. The app caches its own files after a successful first visit over HTTPS or localhost. Reloading offline works once “Offline ready” appears. Cloud mode sends drafts to your provider, whose data policies apply.</p></details></div>
    </footer>
  </>;
}
