import { TicketStatus } from "@/generated/prisma";
import { z } from "zod";

const ticketSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  status: z.nativeEnum(TicketStatus).default("OPEN"),
  imageUrl: z.string().url().optional(),
  cancelReason: z.string().optional(),
});

const ticketCommentSchema = z.strictObject({
  body: z.string(),
});

const createTicketSchema = z.object({
  body: ticketSchema.omit({ status: true, cancelReason: true }),
});

const updateTicketSchema = z.object({
  body: ticketSchema.partial(),
});

const createTicketCommentSchema = z.object({
  body: ticketCommentSchema,
});

const updateTicketCommentSchema = z.object({
  body: ticketCommentSchema.partial(),
});

const ticketValidator = {
  createTicketSchema,
  updateTicketSchema,
  createTicketCommentSchema,
  updateTicketCommentSchema,
};

export default ticketValidator;
