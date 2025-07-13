/**
 * @fileOverview A tool for scheduling appointments.
 *
 * This file defines the Genkit tool and its associated Zod schema for creating appointments.
 * It is not an API endpoint itself but provides the logic to be called by one.
 */

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

// Helper function to parse date and time strings into a UTC Date object
// respecting the provided timezone. This is the robust way to handle timezones.
function createUtcDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Important: The month for JavaScript's Date is 0-indexed (0=Jan, 1=Feb, etc.)
  // We pass the components directly to zonedTimeToUtc to avoid local timezone interpretation.
  return zonedTimeToUtc({
    year: year,
    month: month - 1, // CRITICAL FIX: Month must be 0-indexed.
    day: day,
    hours: hours,
    minutes: minutes
  }, timezone);
}

// This is the core logic for creating an appointment.
// It can be called from any server-side context (e.g., an API route).
export async function createAppointment(input: z.infer<typeof CreateAppointmentSchema>): Promise<{ success: boolean; appointmentId?: string }> {
  try {
    const { date, startTime, endTime, timezone } = input;

    // 1. Convert local time strings to UTC Date objects using the user's timezone.
    const utcStartDate = createUtcDate(date, startTime, timezone);
    const utcEndDate = createUtcDate(date, endTime, timezone);

    // 2. Final check to ensure dates are valid
    if (isNaN(utcStartDate.getTime()) || isNaN(utcEndDate.getTime())) {
      console.error("Invalid date created from input strings and timezone.", { input });
      return { success: false };
    }

    if (utcEndDate <= utcStartDate) {
      console.error("End time must be after start time.", { utcStartDate, utcEndDate });
      return { success: false };
    }

    // 3. Add to Firestore
    const docRef = await addDoc(collection(db, 'appointments'), {
      organizationId: input.organizationId,
      userId: input.userId,
      title: input.title,
      description: input.description || '',
      start: Timestamp.fromDate(utcStartDate),
      end: Timestamp.fromDate(utcEndDate),
      contactId: input.contactId || '',
      contactName: input.contactName || '',
      assignedTo: input.assignedTo || '',
      assignedToName: input.assignedToName || '',
    });

    return { success: true, appointmentId: docRef.id };
  } catch (error) {
    console.error('Error creating appointment:', error);
    return { success: false };
  }
}

// We define the tool for Genkit to use. This provides the structure for the AI.
// The actual execution is handled by the API endpoint calling the `createAppointment` function.
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
    // This function body is used when the tool is called directly within a Genkit flow.
    // In our case, the API endpoint is the primary executor.
    // However, it's good practice to have the tool's implementation here as well.
    return createAppointment(input);
  }
);
