import { useCallback, useRef } from 'react'
import type { ChangeEvent, InputHTMLAttributes } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  content: string
  onCheckboxToggle?: (checkboxIndex: number) => void
}

export function MarkdownPreview({
  content,
  onCheckboxToggle
}: MarkdownPreviewProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const container = contentRef.current
      if (!container || !onCheckboxToggle) return

      const allCheckboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      const checkboxIndex = allCheckboxes.indexOf(e.target)
      if (checkboxIndex === -1) return

      onCheckboxToggle(checkboxIndex)
    },
    [onCheckboxToggle]
  )

  const CheckboxInput = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element => {
      if (props.type === 'checkbox') {
        const isInteractive = Boolean(onCheckboxToggle)

        return (
          <input
            type="checkbox"
            checked={props.checked}
            disabled={!isInteractive}
            className="accent-primary w-4 h-4 mr-1.5 align-middle rounded disabled:cursor-default disabled:opacity-100"
            onChange={handleCheckboxChange}
          />
        )
      }

      return <input {...props} />
    },
    [handleCheckboxChange, onCheckboxToggle]
  )

  return (
    <div
      ref={contentRef}
      className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-primary break-words overflow-hidden [&_li]:marker:text-text-tertiary"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{ input: CheckboxInput }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
