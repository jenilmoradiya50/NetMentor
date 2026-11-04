import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Clock,
  Layers,
  Terminal,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  generatedLessonsApi,
  type GeneratedLessonContent,
} from '../../lib/api';
import { MarkdownView } from '../ui/MarkdownView';
import { useGenerationManager } from '../../context/GenerationManagerContext';

interface GenerateLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLessonSaved: (lessonId: string) => void;
  initialTopic?: string;
  conversationContext?: string;
  conversationId?: string;
  initialDraftLesson?: GeneratedLessonContent | null;
}

export const GenerateLessonModal: React.FC<GenerateLessonModalProps> = ({
  isOpen,
  onClose,
  onLessonSaved,
  initialTopic = '',
  conversationContext,
  conversationId,
  initialDraftLesson,
}) => {
  const { startGeneration } = useGenerationManager();

  // Step state: 'configure' | 'generating' | 'preview'
  const [step, setStep] = useState<'configure' | 'generating' | 'preview'>('configure');

  // Configuration state
  const [topic, setTopic] = useState(initialTopic);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [desiredDepth, setDesiredDepth] = useState<'overview' | 'standard' | 'deep_dive'>('standard');
  const [platform, setPlatform] = useState('Cisco IOS-XE / Linux');
  const [prerequisites, setPrerequisites] = useState('');
  const [goals, setGoals] = useState('');

  // Generated preview state
  const [previewLesson, setPreviewLesson] = useState<GeneratedLessonContent | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'checks' | 'summary'>('content');
  const [expandedSectionIdx, setExpandedSectionIdx] = useState<number>(0);

  // Status & error states
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Sync initial topic / initial draft when opening
  React.useEffect(() => {
    if (isOpen) {
      if (initialDraftLesson) {
        setPreviewLesson(initialDraftLesson);
        setTopic(initialDraftLesson.topic || initialDraftLesson.lessonTitle || initialTopic);
        setStep('preview');
      } else {
        if (initialTopic) setTopic(initialTopic);
        setStep('configure');
        setPreviewLesson(null);
      }
      setErrorMessage(null);
      setErrorDetails([]);
      setShowRegenerateConfirm(false);
    }
  }, [isOpen, initialTopic, initialDraftLesson]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setErrorMessage('Please enter a networking topic.');
      return;
    }

    setErrorMessage(null);
    setErrorDetails([]);
    setIsStarting(true);

    try {
      const prereqsArray = prerequisites
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const goalsArray = goals
        .split(';')
        .map((g) => g.trim())
        .filter(Boolean);

      await startGeneration('lesson', {
        topic: topic.trim(),
        difficulty,
        desiredDepth,
        platform: platform.trim() || undefined,
        prerequisites: prereqsArray.length > 0 ? prereqsArray : undefined,
        goals: goalsArray.length > 0 ? goalsArray : undefined,
        conversationContext: conversationContext || undefined,
        conversationId: conversationId || undefined,
      });

      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to start lesson generation. Please try again.';
      setErrorMessage(msg);
      if (Array.isArray(err?.errors)) {
        setErrorDetails(err.errors);
      }
      setStep('configure');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSave = async () => {
    if (!previewLesson) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await generatedLessonsApi.saveLesson(previewLesson, conversationId);
      if (res.data?.success && res.data.lessonId) {
        onClose();
        onLessonSaved(res.data.lessonId);
      } else {
        setErrorMessage(res.message || 'Failed to save lesson to personal library.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-surface border border-white/10 rounded-2xl shadow-glass overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-surface-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {step === 'preview' ? 'Lesson Preview & Review' : 'Create Custom AI Networking Lesson'}
              </h2>
              <p className="text-xs text-white/50">
                {step === 'preview'
                  ? 'Review the structured lesson before saving to your Personal Learning Library'
                  : 'Generate a structured lesson on any networking topic, curriculum-independent'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3.5 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
              {errorDetails.length > 0 && (
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-white/70">
                  {errorDetails.map((det, i) => (
                    <li key={i}>{det}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* STEP 1: CONFIGURATION */}
          {step === 'configure' && (
            <div className="space-y-4">
              {conversationContext && (
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl text-xs text-white/70 flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-accent">Imported Chat Context:</span> Relevant
                    discussion details from your active AI Tutor conversation will inform lesson generation.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Networking Topic <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Site-to-site IPsec VPNs, BGP Route Selection, OSPF Adjacency Troubleshooting..."
                  className="w-full px-3.5 py-2.5 bg-canvas/60 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 bg-canvas/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent"
                  >
                    <option value="beginner">Beginner (Fundamentals)</option>
                    <option value="intermediate">Intermediate (CCNA level)</option>
                    <option value="advanced">Advanced (CCNP Enterprise)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Desired Depth</label>
                  <select
                    value={desiredDepth}
                    onChange={(e) => setDesiredDepth(e.target.value as any)}
                    className="w-full px-3 py-2 bg-canvas/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-accent"
                  >
                    <option value="overview">Executive Overview (10 mins)</option>
                    <option value="standard">Standard Engineering (20 mins)</option>
                    <option value="deep_dive">Deep Dive Architecture (30+ mins)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Target Platform</label>
                  <input
                    type="text"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="e.g. Cisco IOS-XE, Linux"
                    className="w-full px-3 py-2 bg-canvas/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Prerequisites (Optional)
                </label>
                <input
                  type="text"
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                  placeholder="Comma-separated: e.g. IPv4 Routing, TCP/UDP 3-way handshake"
                  className="w-full px-3.5 py-2 bg-canvas/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  Specific Learning Goals (Optional)
                </label>
                <input
                  type="text"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Semicolon-separated: e.g. Understand Phase 1 vs Phase 2; Inspect show crypto ipsec sa"
                  className="w-full px-3.5 py-2 bg-canvas/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-xs text-white/60 space-y-1">
                <div className="flex items-center gap-1.5 text-white/80 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent" />
                  Personal Learning Library Isolation
                </div>
                <p>
                  Generated lessons are private to your account and stored separately from the official NetMentor curriculum. Official progress and certifications remain untouched.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING SPINNER */}
          {step === 'generating' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative flex items-center justify-center w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                <Sparkles className="w-6 h-6 text-accent animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Synthesizing Technical Lesson</h3>
                <p className="text-xs text-white/60 mt-1 max-w-sm">
                  Generating structured sections, CLI commands, verification tests, and interactive knowledge checks for <span className="text-accent font-semibold">"{topic}"</span>...
                </p>
              </div>
              <div className="text-[11px] text-white/40 font-mono bg-white/5 px-3 py-1 rounded-full border border-white/5">
                Deterministic schema verification active &bull; 0 live tokens leaked
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & REVIEW */}
          {step === 'preview' && previewLesson && (
            <div className="space-y-5">
              {/* Lesson Metadata Card */}
              <div className="p-4 bg-canvas/50 border border-white/10 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
                    {previewLesson.difficulty}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/70 border border-white/10">
                    <Clock className="w-3 h-3 text-white/50" />
                    ~{previewLesson.estimatedMinutes} mins
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/70 border border-white/10">
                    {previewLesson.topic}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {previewLesson.lessonTitle}
                  </h3>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed">
                    {previewLesson.shortDescription}
                  </p>
                </div>

                {/* Objectives */}
                {previewLesson.learningObjectives && previewLesson.learningObjectives.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5">
                      Core Learning Objectives
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {previewLesson.learningObjectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-white/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 p-1 bg-surface-subtle border border-white/10 rounded-xl">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === 'content'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Sections ({previewLesson.sections.length})
                </button>
                <button
                  onClick={() => setActiveTab('checks')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === 'checks'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Knowledge Checks ({previewLesson.knowledgeChecks.length})
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Summary & Next Topics
                </button>
              </div>

              {/* TAB 1: SECTIONS */}
              {activeTab === 'content' && (
                <div className="space-y-3">
                  {previewLesson.sections.map((sec, idx) => {
                    const isExpanded = expandedSectionIdx === idx;
                    return (
                      <div
                        key={sec.id || idx}
                        className="bg-canvas/40 border border-white/10 rounded-xl overflow-hidden transition-all"
                      >
                        <button
                          onClick={() => setExpandedSectionIdx(isExpanded ? -1 : idx)}
                          className="w-full flex items-center justify-between p-3.5 text-left bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/15 text-accent text-xs font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-white">{sec.title}</span>
                          </div>
                          <span className="text-xs text-white/40">{isExpanded ? 'Collapse' : 'Expand'}</span>
                        </button>

                        {isExpanded && (
                          <div className="p-4 border-t border-white/5 space-y-4">
                            <MarkdownView content={sec.explanation} />

                            {/* Commands snippet */}
                            {sec.commands && sec.commands.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <h5 className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-accent" />
                                  CLI Implementation Examples
                                </h5>
                                {sec.commands.map((cmd, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="p-3 bg-canvas/80 border border-white/10 rounded-lg text-xs space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between text-white/50 text-[11px]">
                                      <span>{cmd.platform || 'CLI'}</span>
                                      <span>{cmd.description}</span>
                                    </div>
                                    <pre className="p-2 bg-black/60 rounded text-accent font-mono overflow-x-auto">
                                      {cmd.command}
                                    </pre>
                                    {cmd.expectedOutput && (
                                      <div className="text-[11px] text-white/60">
                                        <span className="text-white/40">Expected: </span>
                                        <span className="font-mono">{cmd.expectedOutput}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Practical scenario */}
                            {sec.practicalScenario && (
                              <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg space-y-2 text-xs">
                                <div className="font-bold text-accent">
                                  Scenario: {sec.practicalScenario.title}
                                </div>
                                <p className="text-white/70">{sec.practicalScenario.description}</p>
                                {sec.practicalScenario.packetFlow && (
                                  <div className="p-2 bg-black/40 rounded text-[11px] text-white/80 font-mono">
                                    {sec.practicalScenario.packetFlow}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: KNOWLEDGE CHECKS */}
              {activeTab === 'checks' && (
                <div className="space-y-3">
                  {previewLesson.knowledgeChecks.map((kc, kIdx) => (
                    <div
                      key={kc.id || kIdx}
                      className="p-4 bg-canvas/40 border border-white/10 rounded-xl space-y-3 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="px-2 py-0.5 rounded bg-accent/20 text-accent font-bold text-[11px]">
                          Q{kIdx + 1}
                        </span>
                        <p className="font-semibold text-white leading-relaxed">{kc.question}</p>
                      </div>

                      <div className="space-y-1.5 pl-6">
                        {kc.options.map((opt) => {
                          const isCorrect = opt.id === kc.correctOptionId;
                          return (
                            <div
                              key={opt.id}
                              className={`p-2 rounded-lg border flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-success/10 border-success/30 text-success'
                                  : 'bg-white/[0.02] border-white/5 text-white/70'
                              }`}
                            >
                              <span className="font-bold">{opt.id}.</span>
                              <span>{opt.text}</span>
                              {isCorrect && (
                                <span className="ml-auto text-[10px] font-bold uppercase bg-success/20 px-1.5 py-0.5 rounded">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="pl-6 pt-2 border-t border-white/5 text-[11px] text-white/60">
                        <span className="font-bold text-white/80">Explanation: </span>
                        {kc.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: SUMMARY */}
              {activeTab === 'summary' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-canvas/40 border border-white/10 rounded-xl space-y-2">
                    <h4 className="font-bold text-white text-sm">Key Takeaways</h4>
                    <ul className="space-y-1 text-white/70 list-disc list-inside">
                      {previewLesson.summary.keyTakeaways.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-canvas/40 border border-white/10 rounded-xl space-y-2">
                    <h4 className="font-bold text-white text-sm">What You Learned</h4>
                    <p className="text-white/70 leading-relaxed">{previewLesson.summary.whatYouLearned}</p>
                  </div>

                  {previewLesson.summary.suggestedNextTopics && (
                    <div className="p-4 bg-canvas/40 border border-white/10 rounded-xl space-y-2">
                      <h4 className="font-bold text-white text-sm">Recommended Next Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {previewLesson.summary.suggestedNextTopics.map((nt, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80 flex items-center gap-1.5"
                          >
                            <ArrowRight className="w-3 h-3 text-accent" />
                            {nt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/10 bg-surface-subtle shrink-0">
          {step === 'configure' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!topic.trim() || isStarting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-glow-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Starting Background Task...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Lesson
                  </>
                )}
              </button>
            </>
          )}

          {step === 'generating' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'preview' && (
            <>
              <div className="flex items-center gap-2">
                {!showRegenerateConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowRegenerateConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                    title="Generate a new version"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-accent" />
                    Regenerate
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 p-1 bg-warning/10 border border-warning/30 rounded-xl">
                    <span className="text-[11px] text-warning px-1.5">Discard preview and retry?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRegenerateConfirm(false);
                        handleGenerate();
                      }}
                      className="px-2 py-1 bg-warning text-black text-[11px] font-bold rounded-lg hover:bg-warning/80"
                    >
                      Yes, Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRegenerateConfirm(false)}
                      className="px-1.5 py-1 text-white/60 text-[11px] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white transition-colors"
                >
                  Discard
                </button>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-success text-white hover:bg-success-hover shadow-sm transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Lesson to Library
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
