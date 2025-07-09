
'use server';

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Ensure these environment variables are set in your deployment environment
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || '465', 10),
  secure: parseInt(process.env.EMAIL_SERVER_PORT || '465', 10) === 465, // Use true for port 465, false for others
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

const sendEmail = async (options: EmailOptions) => {
  // Check if email credentials are configured to prevent errors
  if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
    console.error('Email server credentials are not configured. Skipping email send.');
    // In a development environment, we can just return to not block the flow.
    // In production, you might want to log this error more formally.
    return;
  }
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Qyvoo" <notificaciones@qyvoo.com>',
    ...options,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error('Error occurred while sending email:', error);
    // Depending on the use case, you might want to re-throw the error
    // or handle it gracefully. For invitations, we might not want to
    // block the whole process if only the email fails to send.
  }
};


interface InvitationEmailProps {
    inviteeEmail: string;
    organizationName: string;
    inviterName: string;
}

export const sendInvitationEmail = async ({ inviteeEmail, organizationName, inviterName }: InvitationEmailProps) => {
    const subject = `Has sido invitado a unirte a ${organizationName} en Qyvoo`;
    
    // Construct the registration URL using the base URL from environment variables
    const registrationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/register`;
    
    const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3F51B5; font-size: 24px;">¡Estás invitado!</h1>
        </div>
        <p style="font-size: 16px;">Hola,</p>
        <p style="font-size: 16px;"><strong>${inviterName}</strong> te ha invitado a unirte a la organización <strong>${organizationName}</strong> en Qyvoo.</p>
        <p style="font-size: 16px;">Qyvoo es la plataforma líder para la gestión y automatización de WhatsApp.</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${registrationUrl}" style="background-color: #3F51B5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Aceptar Invitación
          </a>
        </div>
        <p style="font-size: 16px;">Para unirte, haz clic en el botón de arriba y completa el registro usando este correo electrónico: <strong>${inviteeEmail}</strong>. Tu cuenta se vinculará automáticamente a la organización.</p>
        <p style="font-size: 14px; color: #666;">Si no esperabas esta invitación, puedes ignorar este correo electrónico de forma segura.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">
          Qyvoo - Automatiza tus conversaciones.
        </p>
      </div>
    </div>
    `;

    await sendEmail({
        to: inviteeEmail,
        subject,
        html,
    });
};

interface AssignmentEmailProps {
  assigneeEmail: string;
  assigneeName?: string;
  assignerName: string;
  contactName: string;
  chatLink: string;
}

export const sendAssignmentNotificationEmail = async ({
  assigneeEmail,
  assigneeName,
  assignerName,
  contactName,
  chatLink,
}: AssignmentEmailProps) => {
  const subject = `Nueva conversación asignada: ${contactName}`;
  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #3F51B5; font-size: 24px;">Nueva Conversación Asignada</h1>
      </div>
      <p style="font-size: 16px;">Hola ${assigneeName || ''},</p>
      <p style="font-size: 16px;"><strong>${assignerName}</strong> te ha asignado una nueva conversación con el contacto <strong>${contactName}</strong>.</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${chatLink}" style="background-color: #3F51B5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
          Ir a la Conversación
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Por favor, atiende este chat a la brevedad posible.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #888; text-align: center;">
        Qyvoo - Automatiza tus conversaciones.
      </p>
    </div>
  </div>
  `;

  await sendEmail({
    to: assigneeEmail,
    subject,
    html,
  });
};

interface WelcomeEmailProps {
  userEmail: string;
  userName: string;
}

export const sendWelcomeEmail = async ({ userEmail, userName }: WelcomeEmailProps) => {
  const subject = `¡Bienvenido a Qyvoo, ${userName}!`;
  
  const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/login`;
  const qyvooLogoUrl = 'https://qyvoo.vemontech.com/img/logo-2x1.png';

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f7fa; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
        <img src="${qyvooLogoUrl}" alt="Qyvoo Logo" style="max-width: 150px;"/>
      </div>
      <h1 style="color: #1E88E5; font-size: 24px; text-align: center;">¡Bienvenido a bordo, ${userName}!</h1>
      <p style="font-size: 16px;">Estamos encantados de tenerte en Qyvoo. Has dado el primer paso para revolucionar la comunicación con tus clientes a través de WhatsApp.</p>
      <p style="font-size: 16px;">Con Qyvoo, podrás:</p>
      <ul style="font-size: 16px; list-style-type: '✔  '; padding-left: 20px;">
        <li>Automatizar respuestas con asistentes inteligentes.</li>
        <li>Gestionar todas tus conversaciones en un solo lugar.</li>
        <li>Colaborar con tu equipo para ofrecer el mejor servicio.</li>
      </ul>
      <p style="font-size: 16px;">Para empezar, simplemente inicia sesión en tu cuenta:</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${loginUrl}" style="background-color: #1E88E5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
          Iniciar Sesión en Qyvoo
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">Si tienes alguna pregunta, no dudes en visitar nuestro <a href="https://qyvoo.com" target="_blank" style="color: #1E88E5;">sitio web</a> o contactar a nuestro equipo de soporte.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #888; text-align: center;">
        © ${new Date().getFullYear()} Vemontech | Qyvoo - Automatiza tus conversaciones.
      </p>
    </div>
  </div>
  `;

  await sendEmail({
    to: userEmail,
    subject,
    html,
  });
};
