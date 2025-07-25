
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { addDoc, collection, Timestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { zonedTimeToUtc } from 'date-fns-tz';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CreateAppointmentSchema,
  GetFutureAppointmentsSchema,
  AppointmentDetailSchema,
  GetFutureAppointmentsOutputSchema
} from '@/ai/schemas';


function createUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return zonedTimeToUtc(new Date(year, month - 1, day, hour, minute), timezone);
}

export async function createAppointment(input: z.infer<typeof CreateAppointmentSchema>): Promise<{ success: boolean; appointmentId?: string }> {
  try {
    const { date, startTime, endTime, timezone, contactPhone, ...rest } = input;

    const utcStartDate = createUtcDate(date, startTime, timezone);
    const utcEndDate = createUtcDate(date, endTime, timezone);

    if (isNaN(utcStartDate.getTime()) || isNaN(utcEndDate.getTime())) {
      console.error("Invalid date created from input.", { start: utcStartDate, end: utcEndDate, timezone });
      return { success: false };
    }

    if (utcEndDate <= utcStartDate) {
      console.error("End time must be after start time.", { utcStartDate, utcEndDate });
      return { success: false };
    }
    
    let contactId = '';
    let contactName = '';
    let finalTitle = rest.title;

    if (contactPhone) {
      const contactsRef = collection(db, 'contacts');
      const q = query(
        contactsRef, 
        where('userId', '==', rest.userId), 
        where('_chatIdOriginal', '==', contactPhone), 
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const contactDoc = querySnapshot.docs[0];
        contactId = contactDoc.id;
        const contactData = contactDoc.data();
        contactName = `${contactData.nombre || ''} ${contactData.apellido || ''}`.trim() || contactData.telefono;
      } else {
        const phoneOnly = contactPhone.split('@')[0];
        finalTitle = `${rest.title} con ${phoneOnly}`;
      }
    }

    const docRef = await addDoc(collection(db, 'appointments'), {
      organizationId: rest.organizationId,
      userId: rest.userId,
      title: finalTitle,
      description: rest.description || '',
      start: Timestamp.fromDate(utcStartDate),
      end: Timestamp.fromDate(utcEndDate),
      contactId: contactId,
      contactName: contactName,
      assignedTo: rest.assignedTo || '',
      assignedToName: rest.assignedToName || '',
    });

    return { success: true, appointmentId: docRef.id };
  } catch (error) {
    console.error('Error in createAppointment function:', error);
    return { success: false };
  }
}


// Function to get future appointments
export async function getFutureAppointments(input: z.infer<typeof GetFutureAppointmentsSchema>): Promise<z.infer<typeof GetFutureAppointmentsOutputSchema>> {
  try {
    const { contactPhone, organizationId, userId } = input;
    
    // First, find the contact ID based on the phone number (chatId)
    const contactsRef = collection(db, 'contacts');
    const contactQuery = query(
      contactsRef,
      where('userId', '==', userId),
      where('_chatIdOriginal', '==', contactPhone),
      limit(1)
    );
    const contactSnapshot = await getDocs(contactQuery);
    
    if (contactSnapshot.empty) {
      return { appointments: [], count: 0 }; // No contact found, so no appointments
    }
    const contactId = contactSnapshot.docs[0].id;

    // Now, query for future appointments for this contactId in the organization
    const appointmentsRef = collection(db, 'appointments');
    const now = Timestamp.now();
    
    const q = query(
      appointmentsRef,
      where('organizationId', '==', organizationId),
      where('contactId', '==', contactId),
      where('start', '>=', now),
      orderBy('start', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    
    const appointments: z.infer<typeof AppointmentDetailSchema>[] = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const startDate = (data.start as Timestamp).toDate();
      appointments.push({
        title: data.title,
        date: format(startDate, "dd 'de' MMMM 'de' yyyy", { locale: es }),
        startTime: format(startDate, 'HH:mm'),
      });
    });

    return { appointments, count: appointments.length };
  } catch (error) {
    console.error('Error in getFutureAppointments function:', error);
    // Return an empty list in case of an error to prevent breaking the flow
    return { appointments: [], count: 0 };
  }
}


// --- Tool Definitions ---

ai.defineTool(
  {
    name: 'createAppointment',
    description: "Creates a new appointment, meeting, or event in the user's calendar. Use this when a user confirms they want to schedule something. You must provide the date, times and the contact's phone number (WhatsApp Chat ID).",
    inputSchema: CreateAppointmentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
    }),
  },
  createAppointment
);

ai.defineTool(
  {
    name: 'getFutureAppointments',
    description: "Retrieves a list of all upcoming (future) appointments for a specific contact. Use this when a user asks about their scheduled appointments, such as '¿cuándo es mi cita?' or '¿tengo algo agendado?'. You must provide the contact's phone number (WhatsApp Chat ID).",
    inputSchema: GetFutureAppointmentsSchema,
    outputSchema: GetFutureAppointmentsOutputSchema,
  },
  getFutureAppointments
);
