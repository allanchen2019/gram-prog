import React, { useState, useEffect, useRef } from 'react';

// API Configuration
const API_BASE = 'http://localhost:4000/api';

interface Suggestion {
  id: string;
  start: number;
  end: number;
  original: string;
  suggestion: string;
  category: 'spelling' | 'grammar' | 'clarity' | 'tone';
  explanation: string;
}

interface RewriteResult {
  rewrittenText: string;
  explanation: string;
}

interface GeminiModel {
  value: string;
  label: string;
  series: string;
}

export default function App() {
  // Application State
  const [text, setText] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isAutoCheck, setIsAutoCheck] = useState<boolean>(true);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLlmConnected, setIsLlmConnected] = useState<boolean | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-lite-latest');
  const [modelsList, setModelsList] = useState<GeminiModel[]>([
    { value: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite (Latest Fast)', series: '2.0/2.5' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast & Efficient)', series: '1.5' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep & Creative)', series: '1.5' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Next-gen Fast)', series: '2.5' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (GA Frontier)', series: '3.5' },
    { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro (Preview)', series: '3.5' }
  ]);

  // Tone Rewriter State
  const [isRewriting, setIsRewriting] = useState<boolean>(false);
  const [selectedTone, setSelectedTone] = useState<string>('professional');
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [showRewriteModal, setShowRewriteModal] = useState<boolean>(false);

  // Stats
  const [overallTone, setOverallTone] = useState<string>('Neutral');

  // DOM Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync scroll from textarea to backdrop
  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Toggle Dark Mode
  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  // Check LLM backend status & list models on mount
  useEffect(() => {
    // 1. Health check
    fetch(`${API_BASE}/health`)
      .then((res) => res.json())
      .then((data) => {
        setIsLlmConnected(data.llmConfigured);
        if (!data.llmConfigured) {
          setErrorMsg('Gemini API key is not configured. Please add GEMINI_API_KEY in backend/.env.');
        }
      })
      .catch(() => {
        setIsLlmConnected(false);
        setErrorMsg('Cannot connect to backend server. Make sure it is running on http://localhost:4000.');
      });

    // 2. Fetch models dynamically
    fetch(`${API_BASE}/models`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setModelsList(data);
          // If gemini-flash-lite-latest is in the list, auto-select it
          const hasLiteLatest = data.some(m => m.value === 'gemini-flash-lite-latest');
          if (hasLiteLatest) {
            setSelectedModel('gemini-flash-lite-latest');
          } else {
            const hasGemini35 = data.some(m => m.value === 'gemini-3.5-flash');
            if (hasGemini35) {
              setSelectedModel('gemini-3.5-flash');
            }
          }
        }
      })
      .catch((err) => console.error('Error fetching dynamic models list:', err));
  }, []);

  // Main analyze trigger
  const handleAnalyze = async (textToCheck = text) => {
    if (!textToCheck.trim()) {
      setSuggestions([]);
      return;
    }

    setIsChecking(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToCheck,
          options: { spelling: true, grammar: true, clarity: true, tone: true },
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        if (errData.error === 'API_KEY_MISSING') {
          setErrorMsg('Gemini API Key is missing. Please configure GEMINI_API_KEY in backend/.env.');
        } else {
          setErrorMsg(errData.message || 'Error occurred while checking grammar.');
        }
        setIsChecking(false);
        return;
      }

      const data = await response.json();
      setSuggestions(data);

      // Detect overall tone based on categories or simple summary
      if (data.length > 0) {
        const toneCount = data.filter((s: Suggestion) => s.category === 'tone').length;
        const grammarCount = data.filter((s: Suggestion) => s.category === 'grammar').length;
        if (toneCount > 2) setOverallTone('Needs Polish');
        else if (grammarCount > 3) setOverallTone('Informal');
        else setOverallTone('Optimistic');
      } else {
        setOverallTone('Pristine & Clear');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to connect to backend server. Please verify it is running.');
    } finally {
      setIsChecking(false);
    }
  };

  // Debounced auto-check
  useEffect(() => {
    if (!isAutoCheck) return;
    const delayDebounceFn = setTimeout(() => {
      handleAnalyze(text);
    }, 1800); // 1.8 seconds delay

    return () => clearTimeout(delayDebounceFn);
  }, [text, isAutoCheck]);

  // Handle Acceptance
  const handleAcceptSuggestion = (id: string) => {
    const sug = suggestions.find((s) => s.id === id);
    if (!sug) return;

    const oldLength = sug.end - sug.start;
    const newLength = sug.suggestion.length;
    const diff = newLength - oldLength;

    // 1. Replace text in state
    const newText = text.slice(0, sug.start) + sug.suggestion + text.slice(sug.end);
    setText(newText);

    // 2. Filter out this suggestion, and shift all subsequent suggestions
    const updatedSuggestions = suggestions
      .filter((s) => s.id !== id)
      .map((s) => {
        if (s.start > sug.start) {
          return {
            ...s,
            start: s.start + diff,
            end: s.end + diff,
          };
        }
        return s;
      });
    setSuggestions(updatedSuggestions);

    // Focus editor back
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle Dismissal
  const handleDismissSuggestion = (id: string) => {
    setSuggestions(suggestions.filter((s) => s.id !== id));
  };

  // Handle Accept All Suggestions:
  // Step 1 & 2: Correct spelling/grammar with minimal modifications, keeping tone/content intact.
  // Step 3: Recheck the modified segment, present it to UI, and close auto-check.
  const handleAcceptAllSuggestions = async () => {
    if (!text.trim()) return;
    setIsChecking(true);
    setErrorMsg(null);

    try {
      // Step 1 & 2: Call the dedicated minimal correction endpoint
      const response = await fetch(`${API_BASE}/correct-minimal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setErrorMsg(errData.message || 'Failed to execute minimal correction.');
        setIsChecking(false);
        return;
      }

      const data = await response.json();
      if (data && data.rewrittenText !== undefined) {
        const correctedText = data.rewrittenText;

        // Step 3: Re-check the modified text using the check endpoint
        const checkResponse = await fetch(`${API_BASE}/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: correctedText,
            options: { spelling: true, grammar: true, clarity: true, tone: true },
            model: selectedModel,
          }),
        });

        let newSuggestions = [];
        if (checkResponse.ok) {
          newSuggestions = await checkResponse.json();
        }

        // Present to UI
        setText(correctedText);
        setSuggestions(newSuggestions);

        // Turn off auto-check
        setIsAutoCheck(false);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Error during dynamic correction and verification pipeline.');
    } finally {
      setIsChecking(false);
    }
  };

  // Handle Text Selection or Full Tone Rewrite
  const handleRewriteText = async () => {
    if (!text.trim()) return;
    setIsRewriting(true);
    setRewriteResult(null);

    try {
      const response = await fetch(`${API_BASE}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          tone: selectedTone,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        setErrorMsg('Failed to rewrite text. Verify backend server and API keys.');
        setIsRewriting(false);
        return;
      }

      const data = await response.json();
      setRewriteResult(data);
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to contact backend for rewriting.');
    } finally {
      setIsRewriting(false);
    }
  };

  // Replace editor text with rewritten text
  const applyRewrittenText = () => {
    if (rewriteResult) {
      setText(rewriteResult.rewrittenText);
      setShowRewriteModal(false);
      setRewriteResult(null);
      // Run analysis on the newly inserted text
      handleAnalyze(rewriteResult.rewrittenText);
    }
  };

  // Calculate text metrics & readability
  const getMetrics = () => {
    const chars = text.length;
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const sentences = trimmed ? trimmed.split(/[.!?]+/).filter(Boolean).length : 0;

    // Fast syllable count approximation
    const countSyllables = (str: string) => {
      let word = str.toLowerCase();
      if (word.length <= 3) return 1;
      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');
      const vowels = word.match(/[aeiouy]{1,2}/g);
      return vowels ? vowels.length : 1;
    };

    const wordsArr = trimmed ? trimmed.split(/\s+/) : [];
    const syllables = wordsArr.reduce((acc, word) => acc + countSyllables(word), 0);

    // Flesch Reading Ease Formula
    let easeScore = 100;
    if (words > 0 && sentences > 0) {
      easeScore = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    }

    let readabilityGrade = 'Easy';
    if (easeScore < 50) readabilityGrade = 'Difficult (Academic)';
    else if (easeScore < 70) readabilityGrade = 'Medium (Conversational)';
    else readabilityGrade = 'Easy (Broad Audience)';

    const readingTime = Math.max(1, Math.ceil(words / 200));

    return { words, chars, sentences, readabilityGrade, readingTime };
  };

  const { words, chars, readabilityGrade, readingTime } = getMetrics();

  // Split and render highlights in the backdrop
  const renderBackdropText = () => {
    if (suggestions.length === 0) {
      return <span>{text}</span>;
    }

    // Sort only non-overlapping suggestions
    const validSuggestions = [...suggestions]
      .filter((s) => s.start >= 0 && s.end <= text.length && s.start < s.end)
      .sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    for (let i = 0; i < validSuggestions.length; i++) {
      const s = validSuggestions[i];

      // Prevent overlapping highlights
      if (s.start < currentIndex) continue;

      // Plain text preceding suggestion
      if (s.start > currentIndex) {
        elements.push(
          <span key={`text-${currentIndex}`}>{text.slice(currentIndex, s.start)}</span>
        );
      }

      // Highlight element
      const categoryClass = `highlight-${s.category}`;
      const activeClass = activeHighlightId === s.id ? 'active-highlight' : '';
      elements.push(
        <span
          key={s.id}
          className={`highlight-item ${categoryClass} ${activeClass}`}
          onMouseEnter={() => setActiveHighlightId(s.id)}
          onMouseLeave={() => setActiveHighlightId(null)}
          onClick={() => {
            const cardEl = document.getElementById(`card-${s.id}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }}
        >
          {text.slice(s.start, s.end)}
        </span>
      );

      currentIndex = s.end;
    }

    // Remaining text
    if (currentIndex < text.length) {
      elements.push(
        <span key={`text-${currentIndex}`}>{text.slice(currentIndex)}</span>
      );
    }

    return elements;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      
      {/* 1. Sleek Paper Header */}
      <header style={styles.header}>
        <div style={styles.logoGroup}>
          <span style={styles.logo}>gram-prog</span>
          <span style={styles.subtitle}>// clean paper workspace</span>
        </div>

        <div style={styles.headerActions}>
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={styles.modelSelect}
            title="Select Gemini Model"
          >
            {modelsList.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* LLM Connection Badge */}
          <div style={{ ...styles.badge, ...((isLlmConnected === null) ? styles.badgePending : isLlmConnected ? styles.badgeOk : styles.badgeError) }}>
            <span style={styles.badgeDot} />
            {isLlmConnected === null ? 'Connecting...' : isLlmConnected ? 'Gemini Active' : 'API Key Missing'}
          </div>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} style={styles.themeToggleBtn} title="Toggle Dark/Light Mode">
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Monorepo Workspace layout */}
      <div style={styles.mainLayout}>
        
        {/* Distraction-free Writing Column */}
        <div style={styles.editorColumn}>
          
          {errorMsg && (
            <div style={styles.alertBar} className="animate-fade-in">
              <svg style={styles.alertIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex: 1 }}>{errorMsg}</div>
              <button style={styles.alertClose} onClick={() => setErrorMsg(null)}>✕</button>
            </div>
          )}

          {/* Paper Canvas */}
          <div style={styles.paperCanvas}>
            
            <div style={styles.editorWrapper}>
              {/* Highlight backdrop behind */}
              <div ref={backdropRef} className="editor-backdrop" style={styles.editorBackdrop}>
                {renderBackdropText()}
                {/* Visual extra space at bottom to prevent alignment bugs */}
                <div style={{ height: 40 }} />
              </div>

              {/* Textarea on top */}
              <textarea
                ref={textareaRef}
                className="editor-textarea"
                style={styles.editorTextarea}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setErrorMsg(null);
                }}
                onScroll={handleScroll}
                placeholder="Start typing or paste your text here..."
                spellCheck={false}
              />
            </div>

            {/* Bottom Actions under Paper */}
            <div style={styles.canvasActions}>
              <div style={styles.actionLeft}>
                {/* Auto Check Toggle */}
                <label style={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={isAutoCheck}
                    onChange={(e) => setIsAutoCheck(e.target.checked)}
                    style={styles.toggleCheckbox}
                  />
                  <span style={styles.toggleText}>
                    Auto-check
                    <span style={{ ...styles.pulseDot, backgroundColor: isAutoCheck ? '#2B6CB0' : '#8E8981' }} />
                  </span>
                </label>
              </div>

              <div style={styles.actionRight}>
                <button
                  onClick={() => {
                    setText('');
                    setSuggestions([]);
                    setErrorMsg(null);
                  }}
                  style={styles.btnSecondary}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowRewriteModal(true)}
                  style={styles.btnSecondary}
                >
                  AI Rewriter
                </button>
                <button
                  onClick={() => handleAnalyze()}
                  disabled={isChecking}
                  style={styles.btnPrimary}
                >
                  {isChecking ? 'Checking...' : 'Analyze Text'}
                </button>
              </div>
            </div>

          </div>

          {/* Floating Writing Insights Capsule */}
          <div style={styles.insightsCapsule}>
            <div style={styles.insightItem}>
              <span style={styles.insightValue}>{words}</span>
              <span style={styles.insightLabel}>words</span>
            </div>
            <div style={styles.insightDivider} />
            <div style={styles.insightItem}>
              <span style={styles.insightValue}>{chars}</span>
              <span style={styles.insightLabel}>chars</span>
            </div>
            <div style={styles.insightDivider} />
            <div style={styles.insightItem}>
              <span style={styles.insightValue}>{readingTime} min</span>
              <span style={styles.insightLabel}>read time</span>
            </div>
            <div style={styles.insightDivider} />
            <div style={styles.insightItem}>
              <span style={styles.insightValue}>{readabilityGrade}</span>
              <span style={styles.insightLabel}>readability</span>
            </div>
            <div style={styles.insightDivider} />
            <div style={styles.insightItem}>
              <span style={styles.insightValue}>{overallTone}</span>
              <span style={styles.insightLabel}>overall tone</span>
            </div>
          </div>

        </div>

        {/* Suggestion Sidebar Panel */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={styles.sidebarTitle}>Suggestions</h3>
              <span style={styles.sidebarCountBadge}>{suggestions.length}</span>
            </div>
            {suggestions.length > 0 && (
              <button
                onClick={handleAcceptAllSuggestions}
                style={styles.btnAcceptAll}
                title="Accept all suggestions in one click"
              >
                Accept All
              </button>
            )}
          </div>

          <div style={styles.sidebarScrollable}>
            {suggestions.length === 0 ? (
              <div style={styles.emptySidebar}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <div style={styles.emptyTextPrimary}>Your writing is pristine</div>
                <div style={styles.emptyTextSecondary}>No grammar, spelling or style suggestions found in this text.</div>
              </div>
            ) : (
              <div style={styles.cardsList}>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    id={`card-${s.id}`}
                    style={{
                      ...styles.card,
                      ...(activeHighlightId === s.id ? styles.cardActive : {}),
                    }}
                    className="animate-fade-in"
                    onMouseEnter={() => setActiveHighlightId(s.id)}
                    onMouseLeave={() => setActiveHighlightId(null)}
                  >
                    <div style={styles.cardHeader}>
                      <span style={{
                        ...styles.cardCategoryDot,
                        backgroundColor:
                          s.category === 'spelling' ? 'var(--color-spelling-line)' :
                          s.category === 'grammar' ? 'var(--color-grammar-line)' :
                          s.category === 'clarity' ? 'var(--color-clarity-line)' :
                          'var(--color-tone-line)'
                      }} />
                      <span style={styles.cardCategoryText}>{s.category.toUpperCase()}</span>
                    </div>

                    {/* Diff content */}
                    <div style={styles.cardDiffBox}>
                      <span style={styles.diffOriginal}>{s.original}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" style={{ margin: '0 8px' }}>
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                      <span style={styles.diffSuggestion}>{s.suggestion}</span>
                    </div>

                    <p style={styles.cardExplanation}>{s.explanation}</p>

                    <div style={styles.cardActions}>
                      <button
                        onClick={() => handleDismissSuggestion(s.id)}
                        style={styles.cardDismissBtn}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleAcceptSuggestion(s.id)}
                        style={styles.cardAcceptBtn}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* 3. AI Tone Rewriter Modal (Overlay) */}
      {showRewriteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>AI Tone Rewriter</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowRewriteModal(false)}>✕</button>
            </div>

            <p style={styles.modalDesc}>
              Rewrite your entire document to match a target tone or style preset.
            </p>

            <div style={styles.tonePresetsGrid}>
              {['professional', 'casual', 'confident', 'academic', 'friendly', 'concise'].map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  style={{
                    ...styles.tonePresetBtn,
                    ...(selectedTone === tone ? styles.tonePresetBtnActive : {}),
                  }}
                >
                  {tone.charAt(0).toUpperCase() + tone.slice(1)}
                </button>
              ))}
            </div>

            <div style={styles.rewritePreviewContainer}>
              <div style={styles.previewBox}>
                <div style={styles.previewBoxTitle}>Original Text</div>
                <div style={styles.previewBoxContent}>{text || '(No text to rewrite)'}</div>
              </div>

              <div style={styles.previewBox}>
                <div style={styles.previewBoxTitle}>Rewritten Result</div>
                <div style={styles.previewBoxContent}>
                  {isRewriting ? (
                    <div style={styles.loadingSpinner}>
                      <span style={styles.spinnerArc} />
                      Rewriting text with Gemini...
                    </div>
                  ) : rewriteResult ? (
                    <>
                      <div style={styles.rewrittenText}>{rewriteResult.rewrittenText}</div>
                      <div style={styles.rewriteExplanation}>
                        <strong>AI Change Log:</strong> {rewriteResult.explanation}
                      </div>
                    </>
                  ) : (
                    <div style={styles.previewPlaceholder}>
                      Select a tone and click "Rewrite Document" below to see the magic.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowRewriteModal(false)}
                style={styles.btnSecondary}
              >
                Close
              </button>
              {rewriteResult ? (
                <button
                  onClick={applyRewrittenText}
                  style={styles.btnPrimary}
                >
                  Insert / Replace Text
                </button>
              ) : (
                <button
                  onClick={handleRewriteText}
                  disabled={isRewriting || !text.trim()}
                  style={styles.btnPrimary}
                >
                  Rewrite Document
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Visual Styles - Inline JS Styles for complete theme control
const styles: { [key: string]: React.CSSProperties } = {
  header: {
    height: '60px',
    backgroundColor: 'var(--bg-editor)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
    zIndex: 10,
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  logo: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    fontWeight: 400,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.3s ease',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  badgePending: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    color: '#D97706',
  },
  badgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10B981',
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
  },
  themeToggleBtn: {
    background: 'none',
    border: '1px solid var(--border-color)',
    borderRadius: '50%',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-app)',
    transition: 'background-color 0.3s ease',
  },
  editorColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 32px 32px 32px',
    overflowY: 'auto',
    alignItems: 'center',
    position: 'relative',
  },
  alertBar: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#C53030',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
  },
  alertIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
  },
  alertClose: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  paperCanvas: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'var(--bg-editor)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    flex: 1,
    minHeight: '400px',
  },
  editorWrapper: {
    position: 'relative',
    flex: 1,
    width: '100%',
  },
  editorBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: '32px',
    fontFamily: 'var(--font-serif)',
    fontSize: '18px',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowY: 'auto',
    border: 'none',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    color: 'transparent',
    pointerEvents: 'none',
    zIndex: 1,
  },
  editorTextarea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: '32px',
    fontFamily: 'var(--font-serif)',
    fontSize: '18px',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowY: 'auto',
    border: 'none',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'transparent',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
    zIndex: 2,
    transition: 'color 0.3s ease',
  },
  canvasActions: {
    height: '60px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: 'var(--bg-card)',
    flexShrink: 0,
  },
  actionLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  toggleCheckbox: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  toggleText: {
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 500,
  },
  pulseDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
    transition: 'background-color 0.3s ease',
  },
  actionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  btnPrimary: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-editor)',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-sm)',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  insightsCapsule: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)',
    padding: '8px 20px',
    borderRadius: '30px',
    marginTop: '20px',
    gap: '16px',
    maxWidth: '800px',
    width: '100%',
    justifyContent: 'space-around',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  insightItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  insightValue: {
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
  },
  insightLabel: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  insightDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--border-color)',
  },
  sidebar: {
    width: '320px',
    borderLeft: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-sidebar)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  },
  sidebarHeader: {
    height: '60px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontFamily: 'var(--font-sans)',
    fontSize: '15px',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary)',
  },
  sidebarCountBadge: {
    backgroundColor: 'var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    fontFamily: 'var(--font-sans)',
  },
  sidebarScrollable: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  emptySidebar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 20px',
  },
  emptyTextPrimary: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '6px',
    fontFamily: 'var(--font-sans)',
  },
  emptyTextSecondary: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
    fontFamily: 'var(--font-sans)',
  },
  cardsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    cursor: 'pointer',
  },
  cardActive: {
    borderColor: 'var(--border-active)',
    transform: 'translateY(-2px)',
    boxShadow: 'var(--shadow-md)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
  },
  cardCategoryDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  cardCategoryText: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
  },
  cardDiffBox: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '12px',
    fontFamily: 'var(--font-serif)',
    fontSize: '16px',
  },
  diffOriginal: {
    textDecoration: 'line-through',
    color: 'var(--text-tertiary)',
    opacity: 0.8,
  },
  diffSuggestion: {
    color: '#2F855A',
    fontWeight: 600,
    backgroundColor: 'rgba(72, 187, 120, 0.15)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardExplanation: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: '0 0 16px 0',
    fontFamily: 'var(--font-sans)',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cardDismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '6px 12px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    transition: 'color 0.2s ease',
  },
  cardAcceptBtn: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-editor)',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 14px',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(28, 26, 23, 0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: 'var(--bg-editor)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    boxShadow: 'var(--shadow-lg)',
    width: '90%',
    maxWidth: '900px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '12px',
    marginBottom: '12px',
    flexShrink: 0,
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
  },
  modalDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    fontFamily: 'var(--font-sans)',
  },
  tonePresetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '8px',
    marginBottom: '20px',
    flexShrink: 0,
  },
  tonePresetBtn: {
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    padding: '10px 0',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
  },
  tonePresetBtnActive: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-editor)',
    borderColor: 'var(--text-primary)',
  },
  rewritePreviewContainer: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    minHeight: '200px',
    overflowY: 'auto',
    marginBottom: '20px',
  },
  previewBox: {
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-card)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewBoxTitle: {
    height: '34px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-sidebar)',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
  },
  previewBoxContent: {
    flex: 1,
    padding: '16px',
    fontSize: '15px',
    lineHeight: 1.6,
    fontFamily: 'var(--font-serif)',
    color: 'var(--text-primary)',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
  },
  previewPlaceholder: {
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    textAlign: 'center',
    padding: '40px 0',
  },
  rewrittenText: {
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  rewriteExplanation: {
    borderTop: '1px dotted var(--border-color)',
    paddingTop: '12px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 1.4,
  },
  loadingSpinner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    padding: '40px 0',
  },
  spinnerArc: {
    width: '24px',
    height: '24px',
    border: '2px solid var(--border-color)',
    borderTopColor: 'var(--text-primary)',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '12px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
    flexShrink: 0,
  },
  modelSelect: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-editor)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnAcceptAll: {
    backgroundColor: 'rgba(72, 187, 120, 0.15)',
    color: '#2F855A',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// Add standard spin animation to head for rewrite spinner
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
}
