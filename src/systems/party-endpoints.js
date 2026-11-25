export const sitesOrigin = "https://slipstream-racing.ericxyuan.chatgpt.site";
const productionServer = "https://slipstream.ericxyuan.workers.dev";

export function partyEndpoint(origin, room) {
  const server = origin === sitesOrigin ? productionServer : origin;
  if (!room) return new URL("/api/parties", server);
  const url = new URL("/api/parties/" + room + "/socket", server);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}
