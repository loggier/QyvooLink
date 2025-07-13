
import { z } from 'genkit';

// Schema for creating an appointment
export const CreateAppointmentSchema = z.object({
  title: z.string().describe("The main title or purpose of the appointment."),
  date: z.string().describe("The date of the appointment in YYYY-MM-DD format (e.g., '2024-08-10')."),
  startTime: z.string().describe("The start time of the appointment in 24-hour HH:mm format (e.g., '10:00')."),
  endTime: z.string().describe("The end time of the appointment in 24-hour HH:mm format (e.g., '11:00')."),
  description: z.string().optional().describe("A brief description or notes for the appointment."),
  contactPhone: z.string().describe("The phone number (WhatsApp Chat ID) of the contact for the appointment (e.g., '5218112345678@s.whatsapp.net'). This field is required."),
  assignedTo: z.string().optional().describe("The user ID of the team member assigned to the appointment."),
  assignedToName: z.string().optional().describe("The name of the team member assigned to the appointment."),
  organizationId: z.string().describe("The organization ID of the user creating the appointment."),
  userId: z.string().describe("The user ID of the user creating the appointment."),
  timezone: z.string().describe("The IANA timezone of the user (e.g., 'America/Mexico_City')."),
});

// Schema for querying future appointments
export const GetFutureAppointmentsSchema = z.object({
  contactPhone: z.string().describe("The WhatsApp Chat ID of the contact asking for their appointments (e.g., '5218112345678@s.whatsapp.net')."),
  organizationId: z.string().describe("The organization ID of the user requesting the information."),
  userId: z.string().describe("The user ID associated with the organization."),
});

// The structure of a single appointment in the output
export const AppointmentDetailSchema = z.object({
  title: z.string(),
  date: z.string().describe("The date of the appointment, formatted as 'DD de MMMM de YYYY'."),
  startTime: z.string().describe("The start time of the appointment, formatted as 'HH:mm'."),
});

// Output schema for the getFutureAppointments tool
export const GetFutureAppointmentsOutputSchema = z.object({
  appointments: z.array(AppointmentDetailSchema).describe("A list of future appointments."),
  count: z.number().describe("The total number of future appointments found."),
});
