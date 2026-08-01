import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import checkPermission from "@/middleware/checkPermission";
import ticketController from "./ticket.controller";
import ticketValidator from "./ticket.validator";

const ticketRouter = Router();

ticketRouter
  .route("/")
  .post(
    handleAuth(),
    validateRequest(ticketValidator.createTicketSchema),
    ticketController.createTicket,
  )
  .get(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "READ", {
      openForCustomers: true,
      openForVendors: true,
    }),
    ticketController.getPaginatedTickets,
  );
ticketRouter
  .route("/:ticketId/comments")
  .post(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "WRITE"),
    validateRequest(ticketValidator.createTicketCommentSchema),
    ticketController.addCommentToTicket,
  );
ticketRouter
  .route("/:ticketId/comments/:commentId")
  .patch(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "WRITE"),
    validateRequest(ticketValidator.updateTicketCommentSchema),
    ticketController.updateComment,
  )
  .delete(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "DELETE"),
    ticketController.deleteComment,
  );
ticketRouter
  .route("/:id")
  .get(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "READ"),
    ticketController.getTicketById,
  )
  .patch(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "WRITE"),
    validateRequest(ticketValidator.updateTicketSchema),
    ticketController.updateTicket,
  )
  .delete(
    handleAuth(),
    checkPermission(["TICKET_MODULE"], "DELETE"),
    ticketController.deleteTicket,
  );

export default ticketRouter;
