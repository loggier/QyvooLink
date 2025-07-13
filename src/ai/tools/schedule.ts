
'use server';
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

// This is the core logic for creating an appointment.
// It can be called from any server-side context (e.g., an API route).
export async function createAppointment(input: z.infer<typeof CreateAppointmentSchema>): Promise<{ success: boolean; appointmentId?: string }> {
  try {
    const { date, startTime, endTime, timezone } = input;

    // 1. Create a local date-time string from the input.
    // E.g., "2025-07-13 10:00"
    const localStartString = `${date} ${startTime}`;
    const localEndString = `${date} ${endTime}`;

    // 2. Convert this local time string to a UTC Date object using the user's timezone.
    // This is the crucial step. It tells the function: "Treat '10:00' as the time in 'America/Mexico_City',
    // and give me the corresponding UTC time."
    const utcStartDate = zonedTimeToUtc(localStartString, timezone);
    const utcEndDate = zonedTimeToUtc(localEndString, timezone);

    // Final check to ensure dates are valid
    if (isNaN(utcStartDate.getTime()) || isNaN(utcEndDate.getTime())) {
      console.error("Invalid date created from input strings and timezone.");
      return { success: false };
    }

    if (utcEndDate <= utcStartDate) {
      console.error("End time must be after start time.");
      return { success: false };
    }

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
