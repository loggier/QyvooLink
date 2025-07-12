
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Calendar as CalendarIcon, Edit, Trash2, Clock, Contact, UserCog } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppointmentForm, type Appointment } from '@/components/dashboard/schedule/appointment-form';
import type { ContactDetails } from '../contacts/page';
import type { TeamMember } from '../team/page';

export default function SchedulePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const [appointmentsOnSelectedDay, setAppointmentsOnSelectedDay] = useState<Appointment[]>([]);
  const [appointmentDates, setAppointmentDates] = useState<Date[]>([]);

  const [contacts, setContacts] = useState<ContactDetails[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const dataFetchUserId = user?.role === 'agent' ? user?.ownerId : user?.uid;

  const fetchAppointmentsForDay = useCallback(async (date: Date) => {
    if (!user?.organizationId) return;
    setIsLoading(true);
    try {
      const start = startOfDay(date);
      const end = endOfDay(date);

      const q = query(
        collection(db, 'appointments'),
        where('organizationId', '==', user.organizationId),
        where('start', '>=', Timestamp.fromDate(start)),
        where('start', '<=', Timestamp.fromDate(end)),
        orderBy('start', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedAppointments: Appointment[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedAppointments.push({
          id: docSnap.id,
          ...data,
          start: data.start.toDate(),
          end: data.end.toDate(),
        } as Appointment);
      });
      setAppointmentsOnSelectedDay(fetchedAppointments);
    } catch (error) {
      console.error("Error fetching appointments for day:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las citas del día." });
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, toast]);

  const fetchAppointmentsForMonth = useCallback(async (month: Date) => {
    if (!user?.organizationId) return;
     try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const q = query(
        collection(db, 'appointments'),
        where('organizationId', '==', user.organizationId),
        where('start', '>=', Timestamp.fromDate(start)),
        where('start', '<=', Timestamp.fromDate(end))
      );
      
      const querySnapshot = await getDocs(q);
      const datesWithAppointments: Date[] = [];
      querySnapshot.forEach((docSnap) => {
        datesWithAppointments.push(docSnap.data().start.toDate());
      });
      setAppointmentDates(datesWithAppointments);
    } catch (error) {
      console.error("Error fetching appointments for month:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los indicadores de citas." });
    }
  }, [user?.organizationId, toast]);


  const fetchRelatedData = useCallback(async () => {
    if (!dataFetchUserId || !user?.organizationId) return;

    // Fetch contacts
    const contactsQuery = query(collection(db, 'contacts'), where('userId', '==', dataFetchUserId));
    const contactsSnapshot = await getDocs(contactsQuery);
    const fetchedContacts: ContactDetails[] = [];
    contactsSnapshot.forEach(doc => fetchedContacts.push({ id: doc.id, ...doc.data() } as ContactDetails));
    setContacts(fetchedContacts);

    // Fetch team members
    const teamQuery = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
    const teamSnapshot = await getDocs(teamQuery);
    const fetchedMembers: TeamMember[] = [];
    teamSnapshot.forEach(doc => fetchedMembers.push({ uid: doc.id, ...doc.data() } as TeamMember));
    setTeamMembers(fetchedMembers);

  }, [dataFetchUserId, user?.organizationId]);

  useEffect(() => {
    fetchAppointmentsForDay(selectedDate);
  }, [selectedDate, fetchAppointmentsForDay]);

  useEffect(() => {
    fetchAppointmentsForMonth(currentMonth);
  }, [currentMonth, fetchAppointmentsForMonth]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);


  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const handleOpenForm = (appointment: Appointment | null = null) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (appointmentId: string) => {
    try {
        await deleteDoc(doc(db, 'appointments', appointmentId));
        toast({ title: 'Cita Eliminada', description: 'La cita ha sido eliminada exitosamente.' });
        fetchAppointmentsForDay(selectedDate); // Refresh day's list
        fetchAppointmentsForMonth(currentMonth); // Refresh month indicators
    } catch (error) {
        console.error("Error deleting appointment:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la cita." });
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <CalendarIcon className="mr-3 h-8 w-8 text-primary" />
            Agenda de Citas
          </h2>
          <p className="text-muted-foreground">Gestiona tus citas, reuniones y eventos.</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="mt-4 sm:mt-0">
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nueva Cita
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                onMonthChange={handleMonthChange}
                modifiers={{ hasAppointment: appointmentDates }}
                modifiersClassNames={{
                  hasAppointment: 'has-appointment',
                }}
                className="rounded-md"
                locale={es}
              />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Citas para el {format(selectedDate, "dd 'de' MMMM", { locale: es })}</CardTitle>
                    <CardDescription>Eventos programados para el día seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex items-center justify-center p-6 min-h-[200px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : appointmentsOnSelectedDay.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground min-h-[200px] flex flex-col justify-center items-center">
                            <CalendarIcon className="h-12 w-12 mb-2" />
                            <p>No hay citas para este día.</p>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {appointmentsOnSelectedDay.map(app => (
                                <li key={app.id} className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{app.title}</p>
                                            <div className="text-sm text-muted-foreground space-y-1 mt-1">
                                               <p className="flex items-center"><Clock className="h-4 w-4 mr-2" /> {format(app.start, 'HH:mm')} - {format(app.end, 'HH:mm')}</p>
                                               {app.contactName && <p className="flex items-center"><Contact className="h-4 w-4 mr-2" />{app.contactName}</p>}
                                               {app.assignedToName && <p className="flex items-center"><UserCog className="h-4 w-4 mr-2" />{app.assignedToName}</p>}
                                            </div>
                                            {app.description && <p className="text-xs mt-2 italic">{app.description}</p>}
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button variant="outline" size="icon" onClick={() => handleOpenForm(app)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="destructive" size="icon" onClick={() => handleDelete(app.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
      
      {isFormOpen && (
          <AppointmentForm 
            isOpen={isFormOpen}
            setIsOpen={setIsFormOpen}
            appointment={editingAppointment}
            contacts={contacts}
            teamMembers={teamMembers}
            onSave={() => {
              fetchAppointmentsForDay(selectedDate);
              fetchAppointmentsForMonth(currentMonth);
            }}
            selectedDate={selectedDate}
          />
      )}
    </div>
  );
}
