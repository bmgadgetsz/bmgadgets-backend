import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import { Ticket, Prisma } from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import isValidObjectId from "@/utils/isValidObjectId";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { z } from "zod";

const createTicket = async (data: Ticket) => {
  const ticket = await prisma.ticket.create({
    data,
    include: { createdBy: { include: { role: true, vendorProfile: true } } },
  });

  const { data: safeEmail } = z
    .string()
    .email()
    .safeParse(ticket.createdBy?.email);
  if (!safeEmail) return ticket;

  if (ticket.createdBy?.role.isCustomer) {
    await sendMail(
      safeEmail,
      `Your Support Ticket Has Been Raised – ${ticket.id}`,
      `Dear ${ticket.createdBy.name ?? "Customer"},<br>
        Thank you for reaching out to us. Your support ticket ${ticket.id} has been successfully raised.<br>
        <strong>Ticket Details:</strong><br>
        <ul>
          <li>Subject: ${ticket.title}</li>
          <li>Description: ${ticket.description}</li>
          <li>Raised On: ${ticket.createdAt.toLocaleString("en-GB")}</li>
        </ul>
        Our team is reviewing the issue and will get back to you shortly. Thank you for your patience and understanding.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
    );
  } else if (ticket.createdBy?.role.isVendor) {
    await sendMail(
      safeEmail,
      `New Support Ticket Raised – ${ticket.id}`,
      `Dear ${ticket.createdBy.vendorProfile?.contactPersonName ?? "Vendor"},<br>
        Thank you for reaching out to us. Your support ticket ${ticket.id} has been successfully raised.<br>
        <strong>Ticket Details:</strong><br>
        <ul>
          <li>Subject: ${ticket.title}</li>
          <li>Description: ${ticket.description}</li>
          <li>Raised On: ${ticket.createdAt.toLocaleString("en-GB")}</li>
        </ul>
        Our team is reviewing the issue and will get back to you shortly. Thank you for your patience and understanding.<br>
        Please log in to your vendor dashboard to check the status of your ticket.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
    );
  }

  const employeesToBeNotified = await prisma.user.findMany({
    where: {
      role: {
        OR: [
          { isAdmin: true },
          {
            permissions: {
              some: {
                resource: "TICKET_MODULE",
                access: { hasSome: ["WRITE", "DELETE"] },
              },
            },
          },
        ],
      },
    },
  });
  await prisma.notification.createMany({
    data: employeesToBeNotified.map((e) => ({
      type: "TICKET_CREATED",
      title: ticket.createdBy?.role.isCustomer
        ? `New support ticket #${ticket.id} raised by ${ticket.createdBy.name}.`
        : `New support ticket #${ticket.id} raised by vendor ${ticket.createdBy?.vendorProfile?.businessName}.`,
      receiverId: e.id,
      ticketId: ticket.id,
    })),
  });
  const io = getIO();
  employeesToBeNotified.forEach((vh) => {
    io.to(vh.id).emit("notification", {
      id: ticket.id,
    });
  });

  return ticket;
};

const getTicketById = async (id: string) => {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: true,
      comments: true,
    },
  });
};

const getPaginatedTickets = async (
  filters: {
    search?: string;
    creatorType?: "vendor" | "customer";
  } & Partial<Ticket>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const { search, creatorType, ...filterData } = filters;

  const conditions: Prisma.TicketWhereInput[] = [];

  // partial match
  if (search) {
    if (isValidObjectId(search)) conditions.push({ id: search });
    else
      conditions.push({
        OR: [
          ...["title", "description"].map((field) => ({
            [field]: {
              contains: search,
              mode: "insensitive",
            },
          })),
          {
            createdBy: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      });
  }
  // exact match
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }
  if (creatorType) {
    if (creatorType === "vendor") {
      conditions.push({
        createdBy: {
          role: {
            isVendor: true,
          },
        },
      });
    } else {
      conditions.push({
        createdBy: {
          role: {
            isCustomer: true,
          },
        },
      });
    }
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  const [result, total] = await Promise.all([
    await prisma.ticket.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
      include: {
        createdBy: true,
        comments: { include: { createdBy: true } },
      },
    }),
    await prisma.ticket.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit: take },
    data: result,
  };
};

const updateTicket = async (id: string, data: Partial<Ticket>) => {
  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: { createdBy: { include: { role: true, vendorProfile: true } } },
  });

  const { data: safeEmail } = z
    .string()
    .email()
    .safeParse(ticket.createdBy?.email);
  if (!safeEmail) return ticket;

  if (ticket.status === "RESOLVED") {
    if (ticket.createdBy?.role.isCustomer) {
      await sendMail(
        safeEmail,
        `Your Ticket ${ticket.id} Has Been Resolved`,
        `
        Dear ${ticket.createdBy.name ?? "Customer"},<br>
        We’re happy to inform you that your support ticket ${ticket.id} has been marked as resolved.<br>
        <strong>Resolution Summary:</strong><br>
        <em>${data.cancelReason ?? "No summary provided."}</em><br>
        If you believe your issue still requires attention, you can create a new ticket.<br><br>
        Thank you for your cooperation.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
      );
    } else if (ticket.createdBy?.role.isVendor) {
      await sendMail(
        safeEmail,
        `Your Ticket ${ticket.id} Has Been Resolved`,
        `
        Dear ${ticket.createdBy.vendorProfile?.contactPersonName ?? "Vendor"},<br>
        We’re happy to inform you that your support ticket ${ticket.id} has been marked as resolved.<br>
        <strong>Resolution Summary:</strong><br>
        <em>${data.cancelReason ?? "No summary provided."}</em><br>
        If you believe your issue still requires attention, you can create a new ticket via your vendor dashboard.<br><br>
        Thank you for your cooperation.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
      );
    }
  } else if (ticket.status === "CANCELED") {
    if (ticket.createdBy?.role.isCustomer) {
      await sendMail(
        safeEmail,
        `Your Ticket ${ticket.id} Has Been Rejected`,
        `
        Dear ${ticket.createdBy.name ?? "Customer"},<br>
        Your support ticket ${ticket.id} has been reviewed and marked as Rejected.<br>
        <strong>Reason for Rejection:</strong><br>
        <em>${data.cancelReason ?? "No reason provided."}</em><br>
        If you believe this decision was made in error or have additional information to share, please reply to this email or raise a new ticket.<br>
        Thank you for your understanding.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
      );
    } else if (ticket.createdBy?.role.isVendor) {
      await sendMail(
        safeEmail,
        `Ticket ${ticket.id} Has Been Rejected`,
        `
        Dear ${ticket.createdBy.vendorProfile?.contactPersonName ?? "Vendor"},<br>
        The support ticket #${ticket.id} associated with your product or order has been marked as Rejected after review.<br>
        <strong>Reason for Rejection:</strong><br>
        <em>${data.cancelReason ?? "No reason provided."}</em><br>
        Please log in to your dashboard to view details and provide clarification if required.<br>
        Regards,<br>
        Support Team<br>
        bmgadgets.in<br>
        `,
      );
    }
  }

  return ticket;
};

const deleteTicket = async (id: string) => {
  return prisma.ticket.delete({ where: { id } });
};

const addCommentToTicket = async (
  ticketId: string,
  body: string,
  createdById: string,
) => {
  return prisma.ticketComment.create({
    data: {
      ticketId,
      body,
      createdById,
    },
  });
};

const updateComment = async (commentId: string, body: string) => {
  return prisma.ticketComment.update({
    where: { id: commentId },
    data: { body },
  });
};

const deleteComment = async (commentId: string) => {
  return prisma.ticketComment.delete({
    where: { id: commentId },
  });
};

const ticketService = {
  createTicket,
  getTicketById,
  getPaginatedTickets,
  updateTicket,
  deleteTicket,
  addCommentToTicket,
  updateComment,
  deleteComment,
};
export default ticketService;
