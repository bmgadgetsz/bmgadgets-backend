import { z } from "zod";

const fileUpload = z.object({
  body: z.strictObject({
    file: z.any(),
    directory: z.string(),
  }),
});

const commonValidator = { fileUpload };

export default commonValidator;
