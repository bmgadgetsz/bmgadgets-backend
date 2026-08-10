import { z } from "zod";

const fileUpload = z.object({
  body: z.object({
    directory: z.string().optional().default("general"),
  }),
});

const commonValidator = { fileUpload };

export default commonValidator;
