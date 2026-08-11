import { Access, Resource, Role } from "@/generated/prisma"; // Import necessary types
import ApiError from "@/utils/ApiError.js"; // Custom error handling class
import { RequestHandler } from "express"; // Type for Express request handler
import { status as httpStatus } from "http-status"; // HTTP status codes

/**
 * This is the middleware that checks if a user has necessary permissions to perform the action that'll follow
 * @param resource - The module(s) which is being tested for permission check like brands, trend monitoring etc
 * @param action - read / write / delete actions
 */
const checkPermission = (
  resources: Resource[],
  action: Access,
  {
    openForCustomers,
    openForVendors,
  }: { openForCustomers?: boolean; openForVendors?: boolean } = {},
): RequestHandler => {
  return async (_req, res, next) => {
    try {
      const user = res.locals.currentUser; // Retrieve the current user from response locals

      if (!user)
        // Check if user exists
        throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");

      const { role }: { role: Role } = res.locals.currentUser; // Extract role from user

      if (!role) throw new ApiError(httpStatus.FORBIDDEN, "No role assigned"); // No role assigned
      if (role.isAdmin) return next(); // Admin has all permissions
      if (role.isCustomer && openForCustomers) return next(); // Check customer access
      if (role.isVendor && openForVendors) return next(); // Check vendor access

      const hasPermission = resources.every((resource) => {
        // Check permissions for each resource
        const resourcePermission = role.permissions.find(
          (perm) => perm.resource === resource,
        );

        if (!resourcePermission) return false; // No permission found

        if (action === "READ")
          // Check read or write access
          return (
            resourcePermission.access.includes("READ") ||
            resourcePermission.access.includes("WRITE")
          );

        return resourcePermission.access.includes(action); // Check specific action
      });

      if (!hasPermission) {
        // If no permission, throw error
        const moduleList = resources.join(", ");
        throw new ApiError(
          httpStatus.FORBIDDEN,
          `Permission denied for ${action} on ${moduleList}`,
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

export default checkPermission;
