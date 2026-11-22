import adminHandler from "../lib/detective/admin.js";
import casesHandler from "../lib/detective/cases.js";
import clientHandler from "../lib/detective/client.js";
import memberHandler from "../lib/detective/member.js";
import retentionHandler from "../lib/detective/retention.js";

export default async function handler(request, response) {
  const type = request.query.type || "";
  
  if (type === "admin") {
    return adminHandler(request, response);
  }
  if (type === "client") {
    return clientHandler(request, response);
  }
  if (type === "member") {
    return memberHandler(request, response);
  }
  if (type === "retention") {
    return retentionHandler(request, response);
  }
  // default to cases handler
  return casesHandler(request, response);
}
