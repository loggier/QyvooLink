
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { zonedTimeToUtc } from 'date-fns-tz';

export const CreateAppointmentSchema = z.object({
  title: z.string().describe("The main title or purpose of the appointment."),
  date: z.string().describe("The date of the appointment in YYYY-MM-DD format (e.g., '2024-08-10')."),
  startTime: z.string().describe("The start time of the appointment in 24-hour HH:mm format (e.g., '10:00')."),
  endTime: z.string().describe("The end time of the appointment in 24-hour HH:mm format (e.g., '11:00')."),
  description: z.string().optional().describe("A brief description or notes for the appointment."),
  contactName: z.string().optional().describe("The name of the contact person for the appointment."),
  contactId: z.string().optional().describe("The unique ID of the contact, if available."),
  assignedTo: z.string().optional().describe("The user ID of the team member assigned to the appointment."),
  assignedToName: z.string().optional().describe("The name of the team member assigned to the appointment."),
  organizationId: z.string().describe("The organization ID of the user creating the appointment."),
  userId: z.string().describe("The user ID of the user creating the appointment."),
  timezone: z.string().describe("The IANA timezone of the user (e.g., 'America/Mexico_City')."),
});

export async function createAppointment(input: z.infer<typeof CreateAppointmentSchema>): Promise<{ success: boolean; appointmentId?: string }> {
  try {
    const { date, startTime, endTime, timezone, ...rest } = input;

    // 1. Combine date and time into a standard ISO-like string.
    const startDateTimeString = `${date}T${startTime}:00`;
    const endDateTimeString = `${date}T${endTime}:00`;
    
    // 2. Convert the local time string to a UTC Date object using the provided timezone.
    const utcStartDate = zonedTimeToUtc(startDateTimeString, timezone);
    const utcEndDate = zonedTimeToUtc(endDateTimeString, timezone);

    // 3. Final check to ensure dates are valid.
    if (isNaN(utcStartDate.getTime()) || isNaN(utcEndDate.getTime())) {
      console.error("Invalid date created from input.", { start: startDateTimeString, end: endDateTimeString, timezone });
      return { success: false };
    }

    if (utcEndDate <= utcStartDate) {
      console.error("End time must be after start time.", { utcStartDate, utcEndDate });
      return { success: false };
    }
    
    // 4. Add to Firestore using the correct Timestamp format.
    const docRef = await addDoc(collection(db, 'appointments'), {
      organizationId: rest.organizationId,
      userId: rest.userId,
      title: rest.title,
      description: rest.description || '',
      start: Timestamp.fromDate(utcStartDate),
      end: Timestamp.fromDate(utcEndDate),
      contactId: rest.contactId || '',
      contactName: rest.contactName || '',
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
    description: "Creates a new appointment, meeting, or event in the user's calendar. Use this when a user confirms they want to schedule something. You must provide the date and times.",
    inputSchema: CreateAppointmentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
    }),
  },
  async (input) => {
    return createAppointment(input);
  }
);
