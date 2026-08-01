import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import ApiError from "@/utils/ApiError";
import ticketService from "./ticket.service";

const createTicket = catchAsync(async (req, res) => {
  const data = req.body;
  if (
    !res.locals.currentUser.role.isCustomer &&
    !res.locals.currentUser.role.isVendor
  )
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Admins are not allowed to create tickets",
    );

  data.createdById = res.locals.currentUser.id;

  const response = await ticketService.createTicket(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Ticket created successfully",
    data: response,
  });
});

const getTicketById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await ticketService.getTicketById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Ticket fetched successfully",
    data: response,
  });
});

const getPaginatedTickets = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "status", "creatorType"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  if (
    res.locals.currentUser.role.isCustomer ||
    res.locals.currentUser.role.isVendor
  )
    filters.createdById = res.locals.currentUser.id;

  const response = await ticketService.getPaginatedTickets(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Tickets fetched successfully",
    data: response,
  });
});

const updateTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  data.lastModifiedById = res.locals.currentUser.id;
  const response = await ticketService.updateTicket(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Ticket updated successfully",
    data: response,
  });
});

const deleteTicket = catchAsync(async (req, res) => {
  const { id } = req.params;

  const response = await ticketService.deleteTicket(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Ticket deleted successfully",
    data: response,
  });
});

const addCommentToTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { body } = req.body;
  const createdById = res.locals.currentUser.id;

  const response = await ticketService.addCommentToTicket(
    ticketId,
    body,
    createdById,
  );

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Comment added successfully",
    data: response,
  });
});

const updateComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;
  const { body } = req.body;

  const response = await ticketService.updateComment(commentId, body);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Comment updated successfully",
    data: response,
  });
});

const deleteComment = catchAsync(async (req, res) => {
  const { commentId } = req.params;

  const response = await ticketService.deleteComment(commentId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Comment deleted successfully",
    data: response,
  });
});

const ticketController = {
  createTicket,
  getTicketById,
  getPaginatedTickets,
  updateTicket,
  deleteTicket,
  addCommentToTicket,
  updateComment,
  deleteComment,
};
export default ticketController;
