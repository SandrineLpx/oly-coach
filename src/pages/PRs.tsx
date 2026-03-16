import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { format, parseISO, isValid, parse } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PR } from '@/lib/types';

function PRForm({ pr, onSave, onClose }: { pr?: PR; onSave: (data: Omit<PR, 'id'> & { id?: string }) => void; onClose: () => void }) {
  const { preferences } = useAppStore();
  const [liftName, setLiftName] = useState(pr?.liftName || '');
  const [weight, setWeight] = useState(pr?.weight?.toString() || '');
  const [unit, setUnit] = useState<'kg' | 'lb'>(pr?.unit || preferences.units);
  const [date, setDate] = useState(pr?.date || format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liftName.trim() || !weight) return;
    onSave({ id: pr?.id, liftName: liftName.trim(), weight: parseFloat(weight), unit, date });
    onClose();
  };

  const handleDateInput = (value: string) => {
    setDate(value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Lift Name</Label>
        <Input value={liftName} onChange={e => setLiftName(e.target.value)} placeholder="e.g. Snatch" required />
      </div>
      <div>
        <Label>Weight</Label>
        <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0" required />
      </div>
      <div>
        <Label>Unit</Label>
        <div className="flex gap-2 mt-1">
          {(['kg', 'lb'] as const).map(u => (
            <button key={u} type="button" onClick={() => setUnit(u)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${unit === u ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={date}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => handleDateInput(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full">{pr ? 'Update PR' : 'Add PR'}</Button>
    </form>
  );
}

export default function PRs() {
  const { prs, preferences, addPR, updatePR, deletePR } = useAppStore();
  const sortedPRs = [...prs].sort((a, b) => b.weight - a.weight);
  const [addOpen, setAddOpen] = useState(false);
  const [editPR, setEditPR] = useState<PR | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const handleAdd = (data: Omit<PR, 'id'> & { id?: string }) => {
    addPR({ ...data, id: generateId() });
  };

  const handleEdit = (data: Omit<PR, 'id'> & { id?: string }) => {
    if (data.id) updatePR(data.id, data);
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Personal Records</h1>
          <p className="text-muted-foreground text-sm">{prs.length} lifts tracked</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="gold"><Plus className="w-5 h-5" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New PR</DialogTitle></DialogHeader>
            <PRForm onSave={handleAdd} onClose={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </motion.div>

      {prs.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No PRs logged yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap + to add your first lift</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPRs.map((pr, i) => (
            <motion.div key={pr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-4 border border-border flex items-center justify-between">
              <div className="flex-1 cursor-pointer" onClick={() => setEditPR(pr)}>
                <p className="font-semibold">{pr.liftName}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(pr.date), 'MMM d, yyyy')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{pr.weight}</p>
                  <p className="text-xs text-muted-foreground">{pr.unit}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditPR(pr)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {pr.liftName} PR?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletePR(pr.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editPR} onOpenChange={open => !open && setEditPR(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit PR</DialogTitle></DialogHeader>
          {editPR && <PRForm pr={editPR} onSave={handleEdit} onClose={() => setEditPR(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
