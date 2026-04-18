import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Priority = 'primary' | 'secondary' | 'supplemental';

export interface EditorExercise {
  _uid: string;
  name: string;
  sets?: number | null;
  reps?: string | null;
  percent_of_max?: number | null;
  weight?: number | null;
  notes?: string | null;
}

export interface EditorSession {
  _uid: string;
  week_number: number;
  day_of_week: number;
  session_type: string;
  name?: string;
  notes?: string;
  priority?: Priority;
  droppable?: boolean;
  focus_label?: string | null;
  exercises: EditorExercise[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_TYPES = ['T', 'S', 'H', 'T2', 'REST'] as const;

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

interface Props {
  sessions: EditorSession[];
  weeks: number;
  onChange: (next: EditorSession[]) => void;
}

interface ExerciseRowProps {
  ex: EditorExercise;
  onPatch: (patch: Partial<EditorExercise>) => void;
  onDelete: () => void;
}

function SortableExerciseRow({ ex, onPatch, onDelete }: ExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex._uid,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-border p-2 space-y-1.5 bg-muted/20',
        isDragging && 'opacity-60 shadow-lg z-10 relative',
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="touch-none p-1.5 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted cursor-grab active:cursor-grabbing"
          // Prevent the drag handle from stealing focus / scrolling on touch
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Input
          value={ex.name}
          onChange={e => onPatch({ name: e.target.value })}
          placeholder="Exercise name"
          className="h-9 text-sm flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label="Delete exercise"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <Label className="text-[10px] text-muted-foreground">Sets</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={ex.sets ?? ''}
            onChange={e =>
              onPatch({ sets: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="h-9 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Reps</Label>
          <Input
            value={ex.reps ?? ''}
            onChange={e => onPatch({ reps: e.target.value })}
            placeholder="5×3"
            className="h-9 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">%1RM</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={ex.percent_of_max ?? ''}
            onChange={e =>
              onPatch({
                percent_of_max: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="h-9 text-xs"
          />
        </div>
      </div>
      <Textarea
        value={ex.notes ?? ''}
        onChange={e => onPatch({ notes: e.target.value })}
        placeholder="Notes"
        className="min-h-[40px] text-xs"
      />
    </div>
  );
}

export default function WeeklyContentEditor({ sessions, weeks, onChange }: Props) {
  const [activeWeek, setActiveWeek] = useState('1');

  // PointerSensor with small distance prevents drag from firing on simple clicks.
  // TouchSensor with delay lets the user scroll the page normally; long-press to drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const replaceSession = (sUid: string, patch: Partial<EditorSession>) => {
    onChange(sessions.map(s => (s._uid === sUid ? { ...s, ...patch } : s)));
  };

  const replaceExercise = (sUid: string, exUid: string, patch: Partial<EditorExercise>) => {
    onChange(
      sessions.map(s =>
        s._uid === sUid
          ? { ...s, exercises: s.exercises.map(e => (e._uid === exUid ? { ...e, ...patch } : e)) }
          : s,
      ),
    );
  };

  const deleteSession = (sUid: string) => {
    onChange(sessions.filter(s => s._uid !== sUid));
  };

  const addSession = (week: number) => {
    onChange([
      ...sessions,
      {
        _uid: uid(),
        week_number: week,
        day_of_week: 1,
        session_type: 'T',
        name: 'New session',
        exercises: [],
      },
    ]);
  };

  const addExercise = (sUid: string) => {
    onChange(
      sessions.map(s =>
        s._uid === sUid
          ? { ...s, exercises: [...s.exercises, { _uid: uid(), name: 'New exercise' }] }
          : s,
      ),
    );
  };

  const deleteExercise = (sUid: string, exUid: string) => {
    onChange(
      sessions.map(s =>
        s._uid === sUid ? { ...s, exercises: s.exercises.filter(e => e._uid !== exUid) } : s,
      ),
    );
  };

  const handleDragEnd = (sUid: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(
      sessions.map(s => {
        if (s._uid !== sUid) return s;
        const oldIdx = s.exercises.findIndex(e => e._uid === active.id);
        const newIdx = s.exercises.findIndex(e => e._uid === over.id);
        if (oldIdx < 0 || newIdx < 0) return s;
        return { ...s, exercises: arrayMove(s.exercises, oldIdx, newIdx) };
      }),
    );
  };

  const weekArray = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <Tabs value={activeWeek} onValueChange={setActiveWeek} className="space-y-3">
      <TabsList className="w-full overflow-x-auto flex justify-start h-auto flex-wrap">
        {weekArray.map(w => (
          <TabsTrigger key={w} value={String(w)} className="text-xs">
            Wk {w}
          </TabsTrigger>
        ))}
      </TabsList>

      {weekArray.map(w => {
        const weekSessions = sessions
          .filter(s => s.week_number === w)
          .sort((a, b) => a.day_of_week - b.day_of_week);
        return (
          <TabsContent key={w} value={String(w)} className="space-y-3 mt-3">
            {weekSessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No sessions in week {w} yet.
              </p>
            )}

            {weekSessions.map(session => (
              <Card key={session._uid} className="p-3 space-y-3">
                {/* Session header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={session.name ?? ''}
                      onChange={e => replaceSession(session._uid, { name: e.target.value })}
                      placeholder="Session name"
                      className="h-9 text-sm font-semibold"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => deleteSession(session._uid)}
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={String(session.day_of_week)}
                      onValueChange={v => replaceSession(session._uid, { day_of_week: Number(v) })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={session.session_type}
                      onValueChange={v => replaceSession(session._uid, { session_type: v })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SESSION_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Exercises — drag to reorder */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(session._uid)}
                >
                  <SortableContext
                    items={session.exercises.map(e => e._uid)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {session.exercises.map(ex => (
                        <SortableExerciseRow
                          key={ex._uid}
                          ex={ex}
                          onPatch={patch => replaceExercise(session._uid, ex._uid, patch)}
                          onDelete={() => deleteExercise(session._uid, ex._uid)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addExercise(session._uid)}
                  className="w-full h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add exercise
                </Button>
              </Card>
            ))}

            <Button
              variant="outline"
              onClick={() => addSession(w)}
              className="w-full"
            >
              <Plus className="w-4 h-4" /> Add session to week {w}
            </Button>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
