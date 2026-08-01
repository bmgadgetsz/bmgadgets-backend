import env from "@/config/env";
import axios from "axios";

const sendSms = async (
  templateId: string,
  phone: string,
  values: Record<string, string>,
) => {
  try {
    const { data } = await axios.post(
      "https://control.msg91.com/api/v5/flow",
      {
        template_id: templateId,
        recipients: [
          {
            mobiles: `91${phone}`,
            ...values,
          },
        ],
      },
      {
        headers: {
          accept: "application/json",
          authkey: env.message91.authKey,
          "content-type": "application/json",
        },
      },
    );
    console.log("[SMS]: ", data);
  } catch (error) {
    console.error("[SMS Error]: ", error);
  }
};

export default sendSms;
