
"use client";

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { ContactDetails } from '@/app/(app)/dashboard/contacts/page';
import type { TeamMember } from '@/app/(app)/dashboard/team/page';

export interface Appointment {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  contactId?: string;
  contactName?: string;
  assignedTo?: string;
  assignedToName?: string;
}

const appointmentSchema = z.object({
  title: z.string().min(1, "El título es obligatorio."),
  description: z.string().optional(),
  date: z.date({ required_error: "La fecha es obligatoria." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
  contactId: z.string().optional(),
  assignedTo: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  appointment: Appointment | null;
  contacts: ContactDetails[];
  teamMembers: TeamMember[];
  onSave: () => void;
  selectedDate?: Date;
}

export function AppointmentForm({
  isOpen,
  setIsOpen,
  appointment,
  contacts,
  teamMembers,
  onSave,
  selectedDate
}: AppointmentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: '',
      description: '',
      date: selectedDate || new Date(),
      startTime: '09:00',
      endTime: '10:00',
      contactId: undefined,
      assignedTo: undefined,
    }
  });

  useEffect(() => {
    if (appointment) {
      form.reset({
        title: appointment.title,
        description: appointment.description,
        date: appointment.start,
        startTime: format(appointment.start, 'HH:mm'),
        endTime: format(appointment.end, 'HH:mm'),
        contactId: appointment.contactId,
        assignedTo: appointment.assignedTo,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        date: selectedDate || new Date(),
        startTime: '09:00',
        endTime: '10:00',
        contactId: undefined,
        assignedTo: undefined,
      });
    }
  }, [appointment, form, selectedDate]);
  
  const onSubmit = async (data: AppointmentFormData) => {
    if (!user || !user.organizationId) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo identificar la organización." });
        return;
    }
    
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);

    const startDate = setMinutes(setHours(data.date, startHour), startMinute);
    const endDate = setMinutes(setHours(data.date, endHour), endMinute);

    if (endDate <= startDate) {
      form.setError("endTime", { message: "La hora de fin debe ser posterior a la de inicio." });
      return;
    }

    const selectedContact = contacts.find(c => c.id === data.contactId);
    const selectedAssignee = teamMembers.find(m => m.uid === data.assignedTo);

    const appointmentData = {
        organizationId: user.organizationId,
        userId: user.uid,
        title: data.title,
        description: data.description || '',
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
        contactId: data.contactId || '',
        contactName: selectedContact ? `${selectedContact.nombre || ''} ${selectedContact.apellido || ''}`.trim() : '',
        assignedTo: data.assignedTo || '',
        assignedToName: selectedAssignee ? selectedAssignee.fullName || selectedAssignee.email : '',
    };
    
    try {
        if (appointment) {
            const appointmentRef = doc(db, 'appointments', appointment.id);
            await updateDoc(appointmentRef, appointmentData);
            toast({ title: 'Cita Actualizada' });
        } else {
            await addDoc(collection(db, 'appointments'), appointmentData);
            toast({ title: 'Cita Creada' });
        }
        onSave();
        setIsOpen(false);
    } catch (error) {
        console.error("Error saving appointment: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la cita." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Editar Cita' : 'Crear Nueva Cita'}</DialogTitle>
          <DialogDescription>Completa los detalles para agendar el evento.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Reunión de seguimiento" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1990-01-01")}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Clock className="h-4 w-4 mr-1"/>Inicio</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Clock className="h-4 w-4 mr-1"/>Fin</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>

               <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asignado a</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'unassigned' ? undefined : value)} 
                        defaultValue={field.value || 'unassigned'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar miembro del equipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Ninguno</SelectItem>
                          {teamMembers.map(member => (
                            <SelectItem key={member.uid} value={member.uid}>{member.fullName || member.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vincular Contacto (Opcional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'unassigned' ? undefined : value)} 
                        defaultValue={field.value || 'unassigned'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar un contacto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           <SelectItem value="unassigned">Ninguno</SelectItem>
                          {contacts.map(contact => (
                            <SelectItem key={contact.id} value={contact.id}>
                               {`${contact.nombre || ''} ${contact.apellido || ''}`.trim() || contact.telefono}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Añade notas o detalles sobre la cita." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {appointment ? 'Guardar Cambios' : 'Crear Cita'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
