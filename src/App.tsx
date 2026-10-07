import { useEffect, useRef, useState, type FormEvent } from 'react';
import { countWords, MAX_CHARACTERS, MAX_WORDS, TONES, TONE_LABELS, type ApiErrorBody, type Tone } from '../shared/text';
import { Icon } from './Icons';

const EXAMPLE = 'In today’s fast-paced world, effective communication plays a crucial role in fostering meaningful connections. It is important to note that the ability to express ideas in a clear and concise manner can significantly enhance the quality of our interactions. By prioritizing authenticity and embracing a more conversational approach, individuals can cultivate stronger relationships and ensure that their messages resonate with their intended audience.';
const GITHUB_URL = 'https://github.com/sebastianmiletic/humangpt';

export default function App() {
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<Tone>('natural');
  const [output, setOutput] = useState('');
  const [lastRequest, setLastRequest] = useState<{ draft: string; tone: Tone } | null>(null);
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

  const words = countWords(draft);
  const tooManyWords = words > MAX_WORDS;
  const tooManyCharacters = draft.length > MAX_CHARACTERS;
  const limitError = tooManyWords
    ? `Keep your draft under ${MAX_WORDS.toLocaleString()} words. Try one section at a time.`
    : tooManyCharacters ? `Keep your draft under ${MAX_CHARACTERS.toLocaleString()} characters. Try a shorter section.` : '';
  const stale = Boolean(output && lastRequest && (lastRequest.draft !== draft.trim() || lastRequest.tone !== tone));

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'configured' in data && typeof data.configured === 'boolean') {
          setConfigured(data.configured);
        }
      })
      .catch(() => { /* The rewrite request handles network errors if health is unavailable. */ });
    return () => {
      controller.abort();
      controllerRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function rewrite(event?: FormEvent) {
    event?.preventDefault();
    if (controllerRef.current || !draft.trim() || limitError || configured === false) return;
    const submitted = { draft: draft.trim(), tone };
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort('timeout'), 70_000);
    setBusy(true);
    setError('');
    setNotice('Rewriting your draft.');
    setCopied(false);

    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: submitted.draft, tone: submitted.tone }),
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      // Some proxies can deliver a response after cancellation. Never apply it.
      controller.signal.throwIfAborted();
      if (!response.ok) {
        const apiError = data as ApiErrorBody | null;
        throw new Error(apiError?.error?.message || 'Could not rewrite your draft. Please try again.');
      }
      if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string' || !data.text.trim()) {
        throw new Error('The server did not return a rewrite. Please try again.');
      }
      setOutput(data.text);
      setLastRequest(submitted);
      setNotice('Your rewrite is ready. Review it before using it.');
      if (window.matchMedia('(max-width: 760px)').matches) {
        outputSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    } catch (failure) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') {
        setNotice('Rewrite canceled.');
      } else {
        setError(controller.signal.reason === 'timeout'
          ? 'The server took too long to respond. Please try again. Free Render services may need a moment to wake up.'
          : failure instanceof TypeError
            ? 'Could not connect. Check your internet connection and try again.'
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
      setCopied(true);
      setNotice('Rewrite copied to your clipboard.');
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2_500);
    } catch {
      outputRef.current?.focus();
      outputRef.current?.select();
      setNotice('Text selected. Press Ctrl+C or Command+C to copy.');
    }
  }

  function downloadOutput() {
    const url = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'humangpt-rewrite.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice('Your rewrite has been downloaded.');
  }

  function clearDraft() {
    setDraft('');
    setOutput('');
    setLastRequest(null);
    setError('');
    setNotice('Draft cleared.');
    setCopied(false);
    sourceRef.current?.focus();
  }

  return (
    <>
      <a className="skip-link" href="#draft-text">Skip to editor</a>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="HumanGPT home">
          <svg className="brand-mark" width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="currentColor" /><path d="M12 10v20m0-8c0-10 16-10 16 0v8" fill="none" stroke="var(--color-on-accent)" strokeWidth="3.5" strokeLinecap="round" /></svg>
          <span>human<span className="wordmark-light">gpt</span></span>
        </a>
        <a className="github-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer"><Icon name="github" /><span>Open source</span><span className="sr-only"> on GitHub (opens in a new tab)</span></a>
      </header>

      <main className="app-shell">
        <div className="intro">
          <p className="eyebrow">AI writing humanizer</p>
          <h1>Make it sound like you.</h1>
          <p className="intro-copy">Less stiff. More natural. Turn your draft into clear, easy-to-read writing without losing what you want to say.</p>
        </div>

        {configured === false && (
          <div className="configuration-notice" role="status">
            <Icon name="info" />
            <div><strong>One setup step left.</strong> Add <code>OPENAI_API_KEY</code> to the server environment to enable rewriting. <a href={`${GITHUB_URL}#deploy-on-render`} target="_blank" rel="noopener noreferrer">Setup guide<span className="sr-only"> (opens in a new tab)</span></a></div>
          </div>
        )}

        <form onSubmit={rewrite} aria-label="Text humanizer">
          <div className="editor-toolbar">
            <fieldset className="tone-fieldset" disabled={busy}>
              <legend>Writing tone</legend>
              <div className="tone-options">
                {TONES.map((value) => (
                  <label className={`tone-option ${tone === value ? 'selected' : ''}`} key={value}>
                    <input className="tone-input" type="radio" name="tone" value={value} checked={tone === value} onChange={() => { setTone(value); setCopied(false); }} />
                    {TONE_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            <span className="limit-hint">Up to {MAX_WORDS.toLocaleString()} words per rewrite</span>
          </div>

          <div className="workspace">
            <section className="editor-panel source-panel" aria-labelledby="source-heading">
              <div className="panel-heading">
                <h2 id="source-heading"><label htmlFor="draft-text">Your draft</label></h2>
                {draft ? <button type="button" className="text-button" disabled={busy} onClick={clearDraft}>Clear</button>
                  : <button type="button" className="text-button" disabled={busy} onClick={() => { setDraft(EXAMPLE); setError(''); setNotice('Example loaded. Choose a tone and humanize it.'); sourceRef.current?.focus(); }}>Try an example</button>}
              </div>
              <textarea
                id="draft-text"
                ref={sourceRef}
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setError(''); setNotice(''); }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void rewrite();
                  }
                }}
                readOnly={busy}
                placeholder="Paste your text here. A paragraph, an email, a first draft…"
                aria-describedby="draft-limit editor-feedback"
                aria-invalid={Boolean(limitError)}
                spellCheck
              />
              <div className="panel-footer">
                <div className="draft-count" id="draft-limit">
                  <span className={limitError ? 'invalid-count' : ''}>{words.toLocaleString()} <span className="muted">/ {MAX_WORDS.toLocaleString()} words</span></span>
                  <span className="character-count">{draft.length.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} characters</span>
                  <span className="keyboard-hint">Ctrl / ⌘ + Enter</span>
                </div>
                {busy ? <button key="cancel" type="button" className="button button-secondary" onClick={(event) => { event.preventDefault(); controllerRef.current?.abort(); }}><Icon name="close" />Cancel</button>
                  : <button key="rewrite" type="submit" className="button button-primary" disabled={!draft.trim() || Boolean(limitError) || configured === false}>{output ? 'Rewrite again' : 'Humanize text'}<Icon name="arrow" /></button>}
              </div>
            </section>

            <section className="editor-panel result-panel" aria-labelledby="result-heading" ref={outputSectionRef}>
              <div className="panel-heading">
                <h2 id="result-heading">Your rewrite</h2>
                <span className="result-tone">{lastRequest && !busy ? TONE_LABELS[lastRequest.tone] : 'A fresh perspective'}</span>
              </div>
              <div className="result-content" aria-busy={busy}>
                {busy ? <div className="loading-state"><p>Finding the right words…</p><div className="skeleton-lines" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div><p className="loading-note">Good writing takes a moment.</p></div>
                  : output ? <textarea id="output-text" ref={outputRef} readOnly value={output} aria-label="Rewritten text" spellCheck={false} />
                    : <div className="empty-state"><span className="empty-icon"><Icon name="pen" width="25" height="25" /></span><p>A fresh take on your words.</p><span>Your rewrite will appear here.<br />Still your ideas, just a little clearer.</span></div>}
              </div>
              <div className="panel-footer result-footer">
                <span className="output-count">{countWords(output).toLocaleString()} <span className="muted">words</span></span>
                <div className="output-actions">
                  <button type="button" className="icon-button" aria-label="Download rewrite" title="Download as text" disabled={!output || busy} onClick={downloadOutput}><Icon name="download" /></button>
                  <button type="button" className="button button-copy" disabled={!output || busy} onClick={() => void copyOutput()}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy text'}</button>
                </div>
              </div>
            </section>
          </div>
          <div id="editor-feedback" className="editor-feedback">
            {limitError || error ? <p className="error-message" role="alert"><Icon name="info" />{limitError || error}</p>
              : stale ? <p className="stale-message">Your draft or tone has changed. Rewrite again to refresh the result.</p>
                : <p className="review-note"><Icon name="check" />Your meaning matters. Give the rewrite a quick review before using it.</p>}
          </div>
          <p className="sr-only" role="status" aria-live="polite">{notice}</p>
        </form>

        <div className="fine-print"><Icon name="info" /><p>Made for better writing, not detector scores. No tool can guarantee “0% AI” or passing an AI checker.</p></div>
      </main>

      <footer className="site-footer">
        <span className="footer-tagline">A little polish. A lot more you.</span>
        <div className="footer-details">
          <details><summary>How it works</summary><p>Paste up to {MAX_WORDS.toLocaleString()} words, choose a tone, and select Humanize text. AI rewrites the phrasing while aiming to keep your meaning and original language. Review the result, then copy or download it.</p></details>
          <details><summary>Privacy</summary><p>Text is sent to the configured AI provider for rewriting. This app does not save your drafts or rewrites. Your host and AI provider may retain metadata or content according to their policies. Avoid submitting confidential or sensitive information.</p></details>
        </div>
      </footer>
    </>
  );
}
