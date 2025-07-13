
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { addDoc, collection, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { zonedTimeToUtc } from 'date-fns-tz';

export const CreateAppointmentSchema = z.object({
  title: z.string().describe("The main title or purpose of the appointment."),
  date: z.string().describe("The date of the appointment in YYYY-MM-DD format (e.g., '2024-08-10')."),
  startTime: z.string().describe("The start time of the appointment in 24-hour HH:mm format (e.g., '10:00')."),
  endTime: z.string().describe("The end time of the appointment in 24-hour HH:mm format (e.g., '11:00')."),
  description: z.string().optional().describe("A brief description or notes for the appointment."),
  contactPhone: z.string().describe("The phone number of the contact for the appointment, without symbols (e.g., '5218112345678'). This field is required."),
  assignedTo: z.string().optional().describe("The user ID of the team member assigned to the appointment."),
  assignedToName: z.string().optional().describe("The name of the team member assigned to the appointment."),
  organizationId: z.string().describe("The organization ID of the user creating the appointment."),
  userId: z.string().describe("The user ID of the user creating the appointment."),
  timezone: z.string().describe("The IANA timezone of the user (e.g., 'America/Mexico_City')."),
});

function createUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Directly create a date in the target timezone and convert to UTC
  // Note: month is 0-indexed in JS, so we subtract 1
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
      // CRITICAL FIX: Add 'where' clause for userId to ensure data isolation
      const q = query(
        contactsRef, 
        where('userId', '==', rest.userId), 
        where('telefono', '==', contactPhone), 
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const contactDoc = querySnapshot.docs[0];
        contactId = contactDoc.id;
        const contactData = contactDoc.data();
        contactName = `${contactData.nombre || ''} ${contactData.apellido || ''}`.trim() || contactData.telefono;
      } else {
        // If contact not found in this user's contacts, add phone to title
        finalTitle = `${rest.title} con ${contactPhone}`;
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

ai.defineTool(
  {
    name: 'createAppointment',
    description: "Creates a new appointment, meeting, or event in the user's calendar. Use this when a user confirms they want to schedule something. You must provide the date, times and the contact's phone number.",
    inputSchema: CreateAppointmentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
    }),
  },
  createAppointment
);
