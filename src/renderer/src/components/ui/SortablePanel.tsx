import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { springSnap } from './motion'

interface SortablePanelProps {
  id: string
  children: React.ReactNode
}

function GripIcon(): React.ReactElement {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
      <circle cx="2" cy="2" r="1" fill="currentColor" />
      <circle cx="2" cy="6" r="1" fill="currentColor" />
      <circle cx="2" cy="10" r="1" fill="currentColor" />
      <circle cx="6" cy="2" r="1" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="10" r="1" fill="currentColor" />
    </svg>
  )
}

export function SortablePanel({ id, children }: SortablePanelProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <motion.div
        animate={
          isDragging
            ? { scale: 1.02, boxShadow: '0 12px 28px rgba(0,0,0,0.18)' }
            : { scale: 1, boxShadow: '0 0px 0px rgba(0,0,0,0)' }
        }
        transition={springSnap}
        className="group/panel relative"
      >
        <button
          type="button"
          aria-label="Drag panel"
          className={`absolute left-2 top-4 z-10 flex h-5 w-3 items-center justify-center text-text-muted transition-opacity hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${
            isDragging ? 'cursor-grabbing opacity-100' : 'cursor-grab opacity-60 hover:opacity-100'
          }`}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        {children}
      </motion.div>
    </div>
  )
}
