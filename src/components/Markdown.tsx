import ReactMarkdown from 'react-markdown'

interface MarkdownProps {
  children: string
  clamp?: boolean
}

export function Markdown({ children, clamp }: MarkdownProps) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none
      prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2
      prose-headings:text-slate-200 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
      prose-strong:text-slate-200
      prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
      prose-code:text-orange-300 prose-code:bg-slate-800/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800/50 prose-pre:rounded-lg prose-pre:text-xs
      prose-blockquote:border-orange-500/30 prose-blockquote:text-slate-400 prose-blockquote:not-italic
      prose-li:text-slate-300 prose-li:my-0.5
      prose-ul:my-2 prose-ol:my-2
      prose-hr:border-slate-800/50
      ${clamp ? 'line-clamp-4 overflow-hidden' : ''}`}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
