import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronDown, Clipboard, Code2, Download, FileCode2, Gauge, Layers3, LoaderCircle, LockKeyhole, Play, RefreshCw, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Terminal, WandSparkles, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getListObfuscatorPresetsQueryKey, useListObfuscatorPresets, useObfuscateLua } from '@workspace/api-client-react';
import type { ObfuscateLuaInput, ObfuscateLuaResult, ObfuscatorPreset, ObfuscateLuaInputLuaVersion, ObfuscateLuaInputPreset } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const starterSource = `local function greet(name)
  local message = "Hello, " .. name
  print(message)
end

greet("Lua creator")`;

const presetCopy: Record<string, { label: string; detail: string }> = {
  Minify: { label: 'Minify', detail: 'Smallest footprint' },
  Weak: { label: 'Weak', detail: 'Readable protection' },
  Normal: { label: 'Normal', detail: 'Balanced transform' },
  Strong: { label: 'Strong', detail: 'Maximum concealment' },
  Vmify: { label: 'Vmify', detail: 'Virtualized execution' },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') return error.error;
  if (error instanceof Error) return error.message;
  return 'The transformer could not process this source. Check the syntax and try again.';
}

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(17_75%_38%)]" aria-label="Hello Obfuscator">
      <span className="mono text-[15px] font-semibold">H/</span>
    </div>
  );
}

function RailIcon({ children, active = false, label }: { children: ReactNode; active?: boolean; label: string }) {
  return (
    <div aria-label={label} data-testid={`rail-${label.toLowerCase().replaceAll(' ', '-')}`} className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-[hsl(var(--sidebar-primary)/.17)] text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--sidebar-foreground)/.54)]'}`}>
      {children}
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.8)] px-5 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-3 md:hidden">
        <BrandMark />
        <span className="font-semibold tracking-[-.03em]">Hello Obfuscator</span>
      </div>
      <div className="hidden items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))] md:flex">
        <span className="mono text-[hsl(var(--primary))]">workspace</span>
        <span>/</span>
        <span>transform.lua</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] sm:flex">
          <span className="status-dot" />
          <span>Prometheus engine ready</span>
        </div>
        <div className="mono rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-2.5 py-1.5 text-[10px] font-medium tracking-[.08em] text-[hsl(var(--muted-foreground))]">LOCAL WORKSPACE</div>
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] py-5 md:flex">
      <BrandMark />
      <div className="mt-12 flex flex-col gap-3">
        <RailIcon active label="Transformer"><WandSparkles size={18} strokeWidth={1.8} /></RailIcon>
        <RailIcon label="Source"><FileCode2 size={18} strokeWidth={1.8} /></RailIcon>
        <RailIcon label="Presets"><Layers3 size={18} strokeWidth={1.8} /></RailIcon>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <RailIcon label="Security"><LockKeyhole size={17} strokeWidth={1.8} /></RailIcon>
        <div className="mb-1 h-8 w-8 rounded-full border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] text-center text-[10px] leading-8 text-[hsl(var(--sidebar-foreground)/.7)]">LUA</div>
      </div>
    </aside>
  );
}

function PresetSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[67px] rounded-lg skeleton" />)}
    </div>
  );
}

function PresetPicker({ presets, selected, onSelect }: { presets: ObfuscatorPreset[]; selected: string; onSelect: (value: ObfuscateLuaInputPreset) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Transformation preset</label>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">Choose how much the source should change.</p>
        </div>
        <span className="mono hidden text-[10px] text-[hsl(var(--muted-foreground))] sm:block">{presets.length} available</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {presets.map((preset) => {
          const content = presetCopy[preset.name] ?? { label: preset.name, detail: preset.description };
          const isSelected = selected === preset.name;
          return (
            <button key={preset.name} type="button" onClick={() => onSelect(preset.name as ObfuscateLuaInputPreset)} data-testid={`button-preset-${preset.name.toLowerCase()}`} className={`preset-card min-h-[67px] rounded-lg px-3 py-2.5 text-left ${isSelected ? 'is-selected' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[13px] font-semibold ${isSelected ? 'text-[hsl(var(--primary))]' : ''}`}>{content.label}</span>
                {isSelected && <Check size={14} className="text-[hsl(var(--primary))]" />}
              </div>
              <span className="mt-1 block text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">{content.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodePanel({ kind, value, onChange, fileName, onFileNameChange, copy, download, copied }: { kind: 'source' | 'output'; value: string; onChange?: (value: string) => void; fileName?: string; onFileNameChange?: (value: string) => void; copy?: () => void; download?: () => void; copied?: boolean }) {
  const isSource = kind === 'source';
  return (
    <section className={`overflow-hidden rounded-xl border ${isSource ? 'border-[hsl(196_17%_16%)] bg-[hsl(196_17%_16%)]' : 'border-[hsl(196_12%_25%)] bg-[hsl(196_15%_20%)]'} shadow-[var(--shadow-md)]`}>
      <div className={`flex min-h-[54px] items-center justify-between gap-3 border-b px-4 ${isSource ? 'border-[hsl(42_24%_91%/.12)]' : 'border-[hsl(42_24%_91%/.12)]'}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isSource ? 'bg-[hsl(42_24%_91%/.1)] text-[hsl(17_75%_62%)]' : 'bg-[hsl(159_31%_37%/.25)] text-[hsl(159_50%_66%)]'}`}>
            {isSource ? <Code2 size={15} /> : <ShieldCheck size={15} />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[12px] font-semibold text-[hsl(42_24%_91%)]">{isSource ? 'Source Lua' : 'Obfuscated output'}</h2>
            <p className="mono truncate text-[9px] uppercase tracking-[.11em] text-[hsl(42_10%_61%)]">{isSource ? 'input buffer' : 'transform result'}</p>
          </div>
        </div>
        {!isSource && value && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={copy} data-testid="button-copy-output" className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(42_24%_91%/.15)] px-2.5 text-[10px] font-medium text-[hsl(42_24%_91%/.72)] transition-colors hover:bg-[hsl(42_24%_91%/.1)] hover:text-[hsl(42_24%_91%)]">
              {copied ? <Check size={13} /> : <Clipboard size={13} />} <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button type="button" onClick={download} data-testid="button-download-output" aria-label="Download output" className="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(42_24%_91%/.15)] text-[hsl(42_24%_91%/.72)] transition-colors hover:bg-[hsl(42_24%_91%/.1)] hover:text-[hsl(42_24%_91%)]"><Download size={14} /></button>
          </div>
        )}
      </div>
      {isSource && (
        <div className="flex items-center gap-2 border-b border-[hsl(42_24%_91%/.1)] px-4 py-2">
          <Terminal size={12} className="text-[hsl(42_10%_61%)]" />
          <input value={fileName} onChange={(event) => onFileNameChange?.(event.target.value)} data-testid="input-file-name" aria-label="File name" className="mono w-full bg-transparent text-[10px] text-[hsl(42_24%_91%/.75)] outline-none placeholder:text-[hsl(42_10%_61%)]" placeholder="untitled.lua" maxLength={120} />
          <span className="mono text-[9px] text-[hsl(42_10%_61%)]">LUA</span>
        </div>
      )}
      <textarea value={value} onChange={(event) => onChange?.(event.target.value)} readOnly={!isSource} spellCheck={false} data-testid={isSource ? 'textarea-source' : 'textarea-output'} aria-label={isSource ? 'Lua source editor' : 'Obfuscated Lua output'} placeholder={isSource ? 'Paste Lua source here...' : 'Your transformed source will appear here'} className={`mono block w-full border-0 px-4 py-4 text-[12px] outline-none ${isSource ? 'source-editor' : 'output-editor'}`} />
      <div className="flex items-center justify-between border-t border-[hsl(42_24%_91%/.1)] px-4 py-2">
        <span className="mono text-[9px] uppercase tracking-[.12em] text-[hsl(42_10%_61%)]">{isSource ? 'UTF-8 · editable' : 'UTF-8 · read only'}</span>
        <span className="mono text-[10px] text-[hsl(42_10%_61%)]">{value.length.toLocaleString()} chars</span>
      </div>
    </section>
  );
}

function ResultSummary({ result }: { result: ObfuscateLuaResult }) {
  return (
    <div className="animate-rise-delay-2 grid grid-cols-2 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.67)] sm:grid-cols-4">
      <div className="border-b border-r border-[hsl(var(--border))] p-3.5 sm:border-b-0"><p className="mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Input</p><p data-testid="text-input-bytes" className="mt-1 text-[15px] font-semibold">{formatBytes(result.inputBytes)}</p></div>
      <div className="border-b border-[hsl(var(--border))] p-3.5 sm:border-b-0 sm:border-r"><p className="mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Output</p><p data-testid="text-output-bytes" className="mt-1 text-[15px] font-semibold text-[hsl(var(--accent))]">{formatBytes(result.outputBytes)}</p></div>
      <div className="border-r border-[hsl(var(--border))] p-3.5"><p className="mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Runtime</p><p data-testid="text-duration" className="mt-1 text-[15px] font-semibold">{result.durationMs} ms</p></div>
      <div className="p-3.5"><p className="mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Version</p><p data-testid="text-result-version" className="mt-1 text-[15px] font-semibold">{result.luaVersion === 'LuaU' ? 'Luau' : 'Lua 5.1'}</p></div>
    </div>
  );
}

function Workspace() {
  const presetsQuery = useListObfuscatorPresets({ query: { queryKey: getListObfuscatorPresetsQueryKey() } });
  const obfuscate = useObfuscateLua();
  const presets = useMemo(() => presetsQuery.data ?? [], [presetsQuery.data]);
  const [source, setSource] = useState(starterSource);
  const [fileName, setFileName] = useState('transform.lua');
  const [selectedPreset, setSelectedPreset] = useState<string>('Normal');
  const [luaVersion, setLuaVersion] = useState<'auto' | ObfuscateLuaInputLuaVersion>('auto');
  const [prettyPrint, setPrettyPrint] = useState(false);
  const [result, setResult] = useState<ObfuscateLuaResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');

  const activePreset = presets.some((preset) => preset.name === selectedPreset) ? selectedPreset : (presets[0]?.name ?? '');
  const canSubmit = source.trim().length > 0 && presets.length > 0 && !obfuscate.isPending;
  const selectedPresetData = presets.find((preset) => preset.name === activePreset);

  const runTransform = () => {
    if (!canSubmit) return;
    const payload: ObfuscateLuaInput = {
      source,
      preset: activePreset as ObfuscateLuaInputPreset,
      prettyPrint,
      ...(luaVersion !== 'auto' ? { luaVersion } : {}),
      ...(fileName.trim() ? { fileName: fileName.trim() } : {}),
    };
    setNotice('');
    setCopied(false);
    obfuscate.mutate({ data: payload }, {
      onSuccess: (nextResult) => {
        setResult(nextResult);
        setNotice('Transformation complete');
      },
      onError: () => setNotice('Transformation failed'),
    });
  };

  const copyOutput = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.source);
      setCopied(true);
      setNotice('Output copied to clipboard');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice('Clipboard access was unavailable');
    }
  };

  const downloadOutput = () => {
    if (!result) return;
    const blob = new Blob([result.source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName.toLowerCase().endsWith('.lua') ? fileName : `${fileName || 'transformed'}.lua`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Download prepared');
  };

  const resetWorkspace = () => {
    setSource(starterSource);
    setFileName('transform.lua');
    setResult(null);
    setNotice('');
  };

  return (
    <div className="workspace-shell relative flex min-h-[100dvh] overflow-hidden">
      <div className="workspace-grid absolute inset-0" />
      <Sidebar />
      <div className="relative z-10 min-w-0 flex-1">
        <TopBar />
        <main className="mx-auto max-w-[1500px] px-5 pb-12 pt-8 md:px-8 md:pt-10">
          <div className="animate-rise mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]"><span className="h-px w-7 bg-[hsl(var(--primary))]" />Lua transformation bench</div>
              <h1 className="max-w-[700px] text-[clamp(2rem,4vw,3.65rem)] font-semibold leading-[.98] tracking-[-.065em]">Make the source<br /><span className="serif font-normal italic text-[hsl(var(--primary))]">harder to read.</span></h1>
              <p className="mt-4 max-w-[570px] text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">A precise, browser-based workspace for transforming Lua with the Prometheus engine. Source stays in your hands until you press run.</p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.62)] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))] lg:self-auto"><Gauge size={14} className="text-[hsl(var(--accent))]" /><span>Fast, local-feeling workflow</span></div>
          </div>

          {presetsQuery.isLoading && <div className="animate-rise-delay rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.4)] p-5"><PresetSkeleton /></div>}

          {presetsQuery.isError && (
            <div className="animate-rise-delay flex flex-col gap-4 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.05)] p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="state-presets-error">
              <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]"><AlertTriangle size={16} /></span><div><h2 className="text-[13px] font-semibold">Presets are out of reach</h2><p className="mt-1 max-w-lg text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">The Prometheus preset list did not load. Your source is safe; reconnect and try again.</p></div></div>
              <button type="button" onClick={() => presetsQuery.refetch()} data-testid="button-retry-presets" className="button-secondary inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-medium"><RefreshCw size={13} /> Retry connection</button>
            </div>
          )}

          {!presetsQuery.isLoading && !presetsQuery.isError && presets.length === 0 && (
            <div className="animate-rise-delay flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.4)] px-6 py-12 text-center" data-testid="state-presets-empty">
              <Layers3 size={24} className="text-[hsl(var(--muted-foreground))]" />
              <h2 className="mt-3 text-[14px] font-semibold">No transformation presets yet</h2>
              <p className="mt-1 max-w-sm text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">The workspace needs a Prometheus preset before it can transform source.</p>
              <button type="button" onClick={() => presetsQuery.refetch()} data-testid="button-refresh-empty-presets" className="button-secondary mt-4 inline-flex h-9 items-center gap-2 rounded-md px-3 text-[12px] font-medium"><RefreshCw size={13} /> Check again</button>
            </div>
          )}

          {presets.length > 0 && (
            <div className="space-y-6">
              <div className="animate-rise-delay rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] p-5 md:p-6">
                  <PresetPicker presets={presets} selected={activePreset} onSelect={(value) => { setSelectedPreset(value); setResult(null); }} />
                {selectedPresetData && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]"><Sparkles size={12} className="text-[hsl(var(--primary))]" /> {selectedPresetData.description} <span className="mx-1 text-[hsl(var(--border))]">·</span> tuned for {selectedPresetData.luaVersion === 'LuaU' ? 'Luau' : 'Lua 5.1'}</p>}
              </div>

              <div className="animate-rise-delay-2 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <CodePanel kind="source" value={source} onChange={(value) => { setSource(value); setResult(null); }} fileName={fileName} onFileNameChange={setFileName} />
                <CodePanel kind="output" value={result?.source ?? ''} copy={copyOutput} download={downloadOutput} copied={copied} />
              </div>

              <div className="animate-rise-delay-2 flex flex-col gap-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-5 md:flex-row md:items-end md:justify-between md:p-6">
                <div className="grid flex-1 gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2">
                    <label htmlFor="lua-version" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]"><SlidersHorizontal size={13} /> Lua version</label>
                    <div className="relative">
                      <select id="lua-version" value={luaVersion} onChange={(event) => setLuaVersion(event.target.value as 'auto' | ObfuscateLuaInputLuaVersion)} data-testid="select-lua-version" className="control-select h-10 w-full appearance-none rounded-md px-3 pr-9 text-[12px]">
                        <option value="auto">Preset default</option><option value="Lua51">Lua 5.1</option><option value="LuaU">Luau</option>
                      </select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[hsl(var(--muted-foreground))]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]"><Code2 size={13} /> Output style</span>
                    <button type="button" onClick={() => setPrettyPrint((value) => !value)} data-testid="button-toggle-pretty-print" aria-pressed={prettyPrint} className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-left text-[12px] transition-colors ${prettyPrint ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.1)] text-[hsl(var(--accent))]' : 'control-select text-[hsl(var(--muted-foreground))]'}`}><span>{prettyPrint ? 'Pretty printed' : 'Compact output'}</span><span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${prettyPrint ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--muted))]'}`}><span className={`block h-3 w-3 rounded-full bg-[hsl(var(--card))] transition-transform ${prettyPrint ? 'translate-x-3' : ''}`} /></span></button>
                  </div>
                  <div className="flex items-end sm:col-span-2 lg:col-span-1">
                    <button type="button" onClick={resetWorkspace} data-testid="button-reset-workspace" className="button-secondary flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-[12px] font-medium"><RotateCcw size={13} /> Reset</button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:min-w-[210px]">
                  <button type="button" onClick={runTransform} disabled={!canSubmit} data-testid="button-obfuscate" className="button-primary flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
                    {obfuscate.isPending ? <><LoaderCircle size={16} className="spinner" /> Transforming source</> : <><Play size={15} fill="currentColor" /> Obfuscate Lua</>}
                  </button>
                  <span className="text-center text-[10px] text-[hsl(var(--muted-foreground))]">No source is stored between runs.</span>
                </div>
              </div>

              {obfuscate.isError && <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] px-4 py-3" data-testid="state-obfuscation-error"><X size={16} className="mt-0.5 shrink-0 text-[hsl(var(--destructive))]" /><div><p className="text-[12px] font-semibold text-[hsl(var(--destructive))]">Transformation stopped</p><p className="mt-0.5 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">{getErrorMessage(obfuscate.error)}</p></div></div>}
              {result && <ResultSummary result={result} />}
              {notice && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] px-4 py-2.5 text-[11px] text-[hsl(var(--sidebar-foreground))] shadow-[var(--shadow-md)]" role="status" data-testid="status-action-feedback"><Check size={14} className="text-[hsl(var(--sidebar-primary))]" /> {notice}</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Workspace} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;