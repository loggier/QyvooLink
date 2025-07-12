
'use server';
/**
 * @fileOverview A tool for scheduling appointments.
 *
 * - createAppointment - A Genkit tool that allows the AI to create an appointment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { set, parse } from 'date-fns';

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
});

// This tool will be available to the AI model to call.
export const createAppointment = ai.defineTool(
  {
    name: 'createAppointment',
    description: "Creates a new appointment, meeting, or event in the user's calendar. Use this when a user confirms they want to schedule something. You must provide the date and times.",
    inputSchema: CreateAppointmentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
    }),
  },
  async (input, context) => {
    const organizationId = context?.auth?.organizationId;
    const userId = context?.auth?.uid;

    if (!organizationId || !userId) {
      console.error("Error: Organization ID or User ID not found in tool context.");
      return { success: false };
    }
    
    try {
      const baseDate = parse(input.date, 'yyyy-MM-dd', new Date());
      const [startHour, startMinute] = input.startTime.split(':').map(Number);
      const [endHour, endMinute] = input.endTime.split(':').map(Number);
      
      const startDate = set(baseDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });
      const endDate = set(baseDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });

      if (endDate <= startDate) {
        console.error("End time must be after start time.");
        return { success: false };
      }

      const docRef = await addDoc(collection(db, 'appointments'), {
        organizationId: organizationId,
        userId: userId,
        title: input.title,
        description: input.description || '',
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
        contactId: input.contactId || '',
        contactName: input.contactName || '',
        assignedTo: input.assignedTo || '',
        assignedToName: input.assignedToName || '',
      });

      return { success: true, appointmentId: docRef.id };
    } catch (error) {
      console.error('Error creating appointment from tool:', error);
      return { success: false };
    }
  }
);
