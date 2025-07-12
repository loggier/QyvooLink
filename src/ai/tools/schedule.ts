
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
import { parseISO } from 'date-fns';

const CreateAppointmentSchema = z.object({
  title: z.string().describe("The main title or purpose of the appointment."),
  start: z.string().describe("The start date and time of the appointment in ISO 8601 format (e.g., '2024-08-10T10:00:00.000Z')."),
  end: z.string().describe("The end date and time of the appointment in ISO 8601 format (e.g., '2024-08-10T11:00:00.000Z')."),
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
    description: 'Creates a new appointment, meeting, or event in the user\'s calendar. Use this when a user confirms they want to schedule something.',
    inputSchema: CreateAppointmentSchema,
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
    }),
  },
  async (input, context) => {
    // The AI provides the input based on the conversation.
    // We need to extract the organizationId from the tool context to save the appointment correctly.
    const organizationId = context?.auth?.organizationId;
    const userId = context?.auth?.uid;

    if (!organizationId || !userId) {
      console.error("Error: Organization ID or User ID not found in tool context.");
      return { success: false };
    }
    
    try {
      const docRef = await addDoc(collection(db, 'appointments'), {
        organizationId: organizationId,
        userId: userId,
        title: input.title,
        description: input.description || '',
        start: Timestamp.fromDate(parseISO(input.start)),
        end: Timestamp.fromDate(parseISO(input.end)),
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
