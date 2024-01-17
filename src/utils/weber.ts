import request from "request";
import { ReporterData, ReporterOptions } from "../types";

export default function postWeberJSON(
  data: ReporterData,
  options?: ReporterOptions
): void {
  const { dev } = options || {};
  
  // FIXME:
  console.log("需要配置上报的接口");

  let url = dev ? "" : "";
  if (process.env.NODE_ENV === "production") {
    url = ``;
  }
  data.base = {
    ...data.base,
    clientTimestamp: Date.now(),
  };
  const base64Data = btoa(JSON.stringify(data));
  const reqOptions = {
    method: "POST",
    url,
    headers: {
      "Content-Type": "text/plain",
    },
    body: base64Data,
  };
  request(reqOptions, function (error, _response) {
    // eslint-disable-next-line no-console
    if (error) console.log(error);
    // console.log('success',response.body);
  });
}
