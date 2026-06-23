import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KanbanTask, KanbanStatus } from '@shared/types/goal'
import { useKanbanStore } from '../../store/kanbanStore'

const STATUSES: KanbanStatus[] = ['todo', 'in_progress', 'done']

const COLUMN_CONFIG: Record<KanbanStatus, { title: string; emptyMessage: string }> = {
  todo: { title: 'To Do', emptyMessage: 'Nothing queued yet.' },
  in_progress: { title: 'In Progress', emptyMessage: 'Start something from To Do.' },
  done: { title: 'Done', emptyMessage: 'Completed tasks will land here.' }
}

const COLUMN_IDS: Record<KanbanStatus, string> = {
  todo: 'kanban-column:todo',
  in_progress: 'kanban-column:in_progress',
  done: 'kanban-column:done'
}

function sortTasks(tasks: KanbanTask[]): KanbanTask[] {
  return [...tasks].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function getTasksByStatus(tasks: KanbanTask[], status: KanbanStatus): KanbanTask[] {
  return sortTasks(tasks.filter((task) => task.status === status))
}

function getColumnId(status: KanbanStatus): string {
  return COLUMN_IDS[status]
}

function getStatusFromColumnId(id: UniqueIdentifier | null | undefined): KanbanStatus | null {
  if (typeof id !== 'string' || !id.startsWith('kanban-column:')) return null
  const status = id.replace('kanban-column:', '')
  return STATUSES.find((value) => value === status) ?? null
}

function findTask(tasks: KanbanTask[], id: UniqueIdentifier): KanbanTask | undefined {
  return tasks.find((task) => task.id === String(id))
}

function buildTasksFromColumns(
  tasks: KanbanTask[],
  columns: Partial<Record<KanbanStatus, KanbanTask[]>>
): KanbanTask[] {
  return STATUSES.flatMap((status) => {
    const columnTasks = columns[status] ?? getTasksByStatus(tasks, status)
    return sortTasks(columnTasks).map((task, index) => ({
      ...task,
      status,
      position: index
    }))
  })
}

function getTargetColumnStatus(tasks: KanbanTask[], overId: UniqueIdentifier): KanbanStatus | null {
  return getStatusFromColumnId(overId) ?? findTask(tasks, overId)?.status ?? null
}

function formatCompletedDate(date: string | null): string | null {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type DragHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

interface TaskCardProps {
  task: KanbanTask
  onDelete?: (taskId: string) => void
  onUpdateText?: (taskId: string, text: string) => Promise<void>
  dragHandle?: DragHandleProps
  isDragging?: boolean
  isOverlay?: boolean
}

function TaskCard({
  task,
  onDelete,
  onUpdateText,
  dragHandle,
  isDragging = false,
  isOverlay = false
}: TaskCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(task.text)
  const completedLabel = formatCompletedDate(task.completedDate ?? task.completedAt)

  const saveEdit = useCallback(async () => {
    const nextText = draftText.trim()
    if (!nextText) {
      setDraftText(task.text)
      setIsEditing(false)
      return
    }

    if (nextText !== task.text && onUpdateText) {
      await onUpdateText(task.id, nextText)
    }

    setIsEditing(false)
  }, [draftText, onUpdateText, task.id, task.text])

  return (
    <div
      className={`group/task rounded-lg border border-surface-border/40 bg-background p-3 text-sm text-text-primary transition-colors hover:border-primary/30 ${
        isDragging || isOverlay ? 'shadow-lg scale-[1.02] opacity-90' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {!isOverlay && dragHandle ? (
          <button
            type="button"
            aria-label="Drag task"
            className="mt-0.5 shrink-0 cursor-grab text-text-muted transition-colors hover:text-text-secondary active:cursor-grabbing"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            ⋮⋮
          </button>
        ) : (
          <span className="mt-0.5 shrink-0 text-text-muted">⋮⋮</span>
        )}

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onBlur={() => void saveEdit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveEdit()
                }
                if (event.key === 'Escape') {
                  setDraftText(task.text)
                  setIsEditing(false)
                }
              }}
              className="w-full rounded-md border border-primary/30 bg-background px-2 py-1 text-sm text-text-primary outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => {
                if (!isOverlay) setIsEditing(true)
              }}
              className={`block w-full text-left ${
                task.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'
              }`}
            >
              {task.text}
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            {task.source === 'triage' && task.sourceUrl && (
              <button
                type="button"
                onClick={() => window.open(task.sourceUrl ?? '', '_blank')}
                className="rounded-full border border-primary/20 px-2 py-0.5 text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                🔵 GitHub
              </button>
            )}
            {task.status === 'done' && completedLabel && <span>Completed {completedLabel}</span>}
          </div>
        </div>

        {!isOverlay && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="text-text-muted hover:text-urgent rounded-md px-1 opacity-0 transition-all group-hover/task:opacity-100"
            aria-label={`Delete ${task.text}`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

function SortableTaskCard({
  task,
  onDelete,
  onUpdateText
}: {
  task: KanbanTask
  onDelete: (taskId: string) => void
  onUpdateText: (taskId: string, text: string) => Promise<void>
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      <TaskCard
        task={task}
        onDelete={onDelete}
        onUpdateText={onUpdateText}
        dragHandle={{ attributes, listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}

interface ColumnProps {
  status: KanbanStatus
  tasks: KanbanTask[]
  totalCount: number
  addTaskValue: string
  onAddTaskValueChange: (value: string) => void
  onAddTask: () => Promise<void>
  onDeleteTask: (taskId: string) => void
  onUpdateTaskText: (taskId: string, text: string) => Promise<void>
}

function Column({
  status,
  tasks,
  totalCount,
  addTaskValue,
  onAddTaskValueChange,
  onAddTask,
  onDeleteTask,
  onUpdateTaskText
}: ColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: getColumnId(status) })
  const config = COLUMN_CONFIG[status]

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] rounded-lg border border-surface-border/40 bg-surface-muted/20 p-3 ${
        isOver ? 'border-primary/40 bg-primary/5' : ''
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">
        {config.title} ({totalCount})
      </div>

      {status === 'todo' && (
        <input
          value={addTaskValue}
          onChange={(event) => onAddTaskValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onAddTask()
            }
          }}
          placeholder="+ Add task"
          className="text-sm rounded-md border border-dashed border-surface-border/40 px-3 py-2 bg-transparent placeholder:text-text-muted w-full mb-3"
        />
      )}

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[120px]">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onDelete={onDeleteTask}
              onUpdateText={onUpdateTaskText}
            />
          ))}

          {tasks.length === 0 && (
            <div className="rounded-lg border border-dashed border-surface-border/30 px-3 py-6 text-center text-sm text-text-muted">
              {config.emptyMessage}
            </div>
          )}
        </div>
      </SortableContext>

      {status === 'done' && totalCount > tasks.length && (
        <div className="mt-2 text-xs text-text-muted">
          Showing the 10 most recent completed tasks.
        </div>
      )}
    </div>
  )
}

export function KanbanBoard(): React.ReactElement {
  const tasks = useKanbanStore((state) => state.tasks)
  const isLoading = useKanbanStore((state) => state.isLoading)
  const error = useKanbanStore((state) => state.error)
  const addTask = useKanbanStore((state) => state.addTask)
  const moveTask = useKanbanStore((state) => state.moveTask)
  const reorderTask = useKanbanStore((state) => state.reorderTask)
  const updateTaskText = useKanbanStore((state) => state.updateTaskText)
  const deleteTask = useKanbanStore((state) => state.deleteTask)

  const [draftTasks, setDraftTasks] = useState<KanbanTask[] | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [newTaskText, setNewTaskText] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const workingTasks = draftTasks ?? tasks

  const allColumns = useMemo(
    () => ({
      todo: getTasksByStatus(workingTasks, 'todo'),
      in_progress: getTasksByStatus(workingTasks, 'in_progress'),
      done: getTasksByStatus(workingTasks, 'done')
    }),
    [workingTasks]
  )

  const visibleColumns = useMemo(
    () => ({
      todo: allColumns.todo,
      in_progress: allColumns.in_progress,
      done: allColumns.done.slice(-10)
    }),
    [allColumns]
  )

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null
    return findTask(workingTasks, activeTaskId) ?? findTask(tasks, activeTaskId) ?? null
  }, [activeTaskId, tasks, workingTasks])

  const handleAddTask = useCallback(async () => {
    const text = newTaskText.trim()
    if (!text) return
    await addTask(text)
    setNewTaskText('')
  }, [addTask, newTaskText])

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      void deleteTask(taskId)
    },
    [deleteTask]
  )

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveTaskId(String(active.id))
      setDraftTasks(tasks)
    },
    [tasks]
  )

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return

      setDraftTasks((currentTasks) => {
        const baseTasks = currentTasks ?? tasks
        const activeTask = findTask(baseTasks, active.id)
        if (!activeTask) return currentTasks ?? tasks

        const targetStatus = getTargetColumnStatus(baseTasks, over.id)
        if (!targetStatus) return currentTasks ?? tasks

        const activeColumn = getTasksByStatus(baseTasks, activeTask.status)
        const activeIndex = activeColumn.findIndex((task) => task.id === activeTask.id)
        if (activeIndex === -1) return currentTasks ?? tasks

        if (activeTask.status === targetStatus) {
          const targetColumn = activeColumn
          const targetIndex = (() => {
            const overIndex = targetColumn.findIndex((task) => task.id === String(over.id))
            return overIndex >= 0 ? overIndex : targetColumn.length - 1
          })()

          if (targetIndex === activeIndex) return baseTasks

          return buildTasksFromColumns(baseTasks, {
            [activeTask.status]: arrayMove(targetColumn, activeIndex, targetIndex)
          })
        }

        const nextSourceColumn = activeColumn.filter((task) => task.id !== activeTask.id)
        const targetColumn = getTasksByStatus(baseTasks, targetStatus)
        const targetIndex = (() => {
          const overIndex = targetColumn.findIndex((task) => task.id === String(over.id))
          return overIndex >= 0 ? overIndex : targetColumn.length
        })()
        const nextTargetColumn = [...targetColumn]
        nextTargetColumn.splice(targetIndex, 0, { ...activeTask, status: targetStatus })

        return buildTasksFromColumns(baseTasks, {
          [activeTask.status]: nextSourceColumn,
          [targetStatus]: nextTargetColumn
        })
      })
    },
    [tasks]
  )

  const resetDragState = useCallback(() => {
    setActiveTaskId(null)
    setDraftTasks(null)
  }, [])

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      const finalTasks = draftTasks ?? tasks
      resetDragState()
      if (!over) return

      const originalTask = findTask(tasks, active.id)
      const updatedTask = findTask(finalTasks, active.id)
      if (!originalTask || !updatedTask) return

      if (originalTask.status !== updatedTask.status) {
        await moveTask(originalTask.id, updatedTask.status, updatedTask.position)
        return
      }

      if (originalTask.position !== updatedTask.position) {
        await reorderTask(originalTask.id, updatedTask.position)
      }
    },
    [draftTasks, moveTask, reorderTask, resetDragState, tasks]
  )

  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">To Do</h2>
        {isLoading && <span className="text-xs text-text-muted">Loading…</span>}
      </div>

      {error && <p className="mb-3 text-xs text-urgent">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => {
          void handleDragEnd(event)
        }}
        onDragCancel={resetDragState}
      >
        <div className="flex gap-4 overflow-x-auto">
          {STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={visibleColumns[status]}
              totalCount={allColumns[status].length}
              addTaskValue={newTaskText}
              onAddTaskValueChange={setNewTaskText}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTaskText={updateTaskText}
            />
          ))}
        </div>

        <DragOverlay>{activeTask ? <TaskCard task={activeTask} isOverlay /> : null}</DragOverlay>
      </DndContext>
    </section>
  )
}
