/**
 * Minimal code block. No syntax highlighter yet — swap in Shiki or
 * `next/mdx` + rehype-pretty-code when the docs grow past a handful of pages.
 */

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre
      className="overflow-x-auto rounded-2xl border p-5 text-sm leading-relaxed"
      style={{ borderColor: 'var(--recall-border)' }}
      data-language={language}
    >
      <code className="font-mono">{code}</code>
    </pre>
  );
}
