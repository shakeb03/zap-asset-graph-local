import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send } from 'lucide-react';
import { askAssistant } from '../api';
import type { Asset } from '../types';

interface AssistantDrawerProps {
  assets: Asset[];
  healthSummary?: { healthScore: number; orphanedCount: number; pausedCount: number; spofCount: number };
  onSelectAsset: (assetId: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function segmentTextWithAssets(
  text: string,
  assets: Array<{ id: string; name: string }>,
  onSelect: (id: string) => void
): ReactNode {
  if (assets.length === 0) return text;
  const byName = assets
    .filter((a) => a.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const parts: ReactNode[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let best: { name: string; id: string; index: number } | null = null;
    for (const a of byName) {
      const idx = remaining.indexOf(a.name);
      if (idx !== -1 && (best === null || idx < best.index))
        best = { name: a.name, id: a.id, index: idx };
    }
    if (best === null) {
      parts.push(remaining);
      break;
    }
    if (best.index > 0) parts.push(remaining.slice(0, best.index));
    parts.push(
      <button
        key={`${best.id}-${parts.length}`}
        type="button"
        onClick={() => onSelect(best!.id)}
        className="rounded bg-[#ff6b35]/20 px-1 py-0.5 text-[#ff6b35] underline decoration-[#ff6b35]/50 hover:bg-[#ff6b35]/30"
      >
        {best.name}
      </button>
    );
    remaining = remaining.slice(best.index + best.name.length);
  }
  return <>{parts}</>;
}

function processChildrenWithAssets(
  children: ReactNode,
  assetList: Array<{ id: string; name: string }>,
  onSelect: (id: string) => void
): ReactNode {
  if (children == null) return null;
  if (typeof children === 'string') return segmentTextWithAssets(children, assetList, onSelect);
  if (Array.isArray(children))
    return children.map((child, i) => (
      <span key={i}>{processChildrenWithAssets(child, assetList, onSelect)}</span>
    ));
  if (children && typeof children === 'object' && 'props' in children && (children as React.ReactElement).props?.children != null) {
    const el = children as React.ReactElement;
    return React.cloneElement(el, {}, processChildrenWithAssets(el.props.children, assetList, onSelect));
  }
  return children;
}

export function AssistantDrawer({
  assets,
  healthSummary,
  onSelectAsset,
}: AssistantDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length) scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [open, messages]);

  const buildContext = () => {
    const summary = assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      owner: a.owner,
      workspace: a.workspace,
      triggerApp: a.triggerApp,
      actionApps: a.actionApps,
      dependencies: (a.dependenciesAsDependent ?? []).map((d) => d.dependency.name),
    }));
    return {
      assets: summary,
      totalZaps: assets.filter((a) => a.type === 'zap').length,
      totalConnections: assets.filter((a) => a.type === 'connection').length,
      health: healthSummary ?? null,
    };
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setLoading(true);
    setError(null);
    try {
      const { text } = await askAssistant(msg, buildContext());
      setMessages((m) => [...m, { role: 'assistant', content: text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get response');
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I couldn’t get a response. Try again or check that the backend is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  const assetList = assets.map((a) => ({ id: a.id, name: a.name }));

  const markdownComponents = {
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mb-2 last:mb-0 text-zinc-300 leading-relaxed">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </p>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold text-white">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </strong>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="mb-2 list-disc pl-5 space-y-0.5 text-zinc-300">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="mb-2 list-decimal pl-5 space-y-0.5 text-zinc-300">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="leading-snug">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </li>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="mt-3 mb-1 text-sm font-semibold text-white first:mt-0">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </h3>
    ),
    h4: ({ children }: { children?: ReactNode }) => (
      <h4 className="mt-2 mb-0.5 text-xs font-semibold text-zinc-200 uppercase tracking-wide">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </h4>
    ),
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="mt-0 mb-2 text-base font-semibold text-white">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="mt-3 mb-1.5 text-sm font-semibold text-white first:mt-0">
        {processChildrenWithAssets(children, assetList, onSelectAsset)}
      </h2>
    ),
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#2a2a3a] bg-[#12121a] text-[#ff6b35] shadow-lg transition-colors hover:border-[#ff6b35] hover:bg-[#2a2a3a]"
        aria-label="Open assistant"
      >
        <MessageCircle size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-[#2a2a3a] bg-[#12121a] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a3a] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Governance Assistant</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-zinc-400 hover:bg-[#2a2a3a] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 && (
                <p className="text-sm text-zinc-500">
                  Ask about impact, ownership, or risk. Try: “What breaks if we disconnect Google Sheets?” or “Which zaps have no owner?”
                </p>
              )}
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === 'user'
                        ? 'ml-4 rounded-lg bg-[#2a2a3a] px-3 py-2 text-sm text-zinc-200'
                        : 'rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-zinc-300'
                    }
                  >
                    {m.role === 'assistant' ? (
                      <div className="assistant-message text-sm">
                        <ReactMarkdown components={markdownComponents}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap text-zinc-200">{m.content}</span>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-zinc-500">
                    Thinking…
                  </div>
                )}
              </div>
              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            <div className="shrink-0 border-t border-[#2a2a3a] p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your automations…"
                  className="flex-1 rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[#ff6b35] focus:outline-none focus:ring-1 focus:ring-[#ff6b35]"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-md bg-[#ff6b35] p-2 text-white transition-colors hover:bg-[#ff7f4d] disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
