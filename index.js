import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = {};

wss.on("connection", (ws) => {
  let roomId = null;
  let color = null;

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());

    // 방 입장
    if (data.type === "join") {
      roomId = data.roomId;

      if (!rooms[roomId]) {
        rooms[roomId] = { players: [] };
      }

      const room = rooms[roomId];

      if (room.players.length >= 2) {
        ws.send(JSON.stringify({ type: "full" }));
        return;
      }

      room.players.push(ws);
      color = room.players.length === 1 ? "white" : "black";

      ws.send(JSON.stringify({
        type: "start",
        color
      }));
    }

    // 이동 전달
    if (data.type === "move") {
      const room = rooms[roomId];

      room?.players.forEach((p) => {
        if (p !== ws) {
          p.send(JSON.stringify(data));
        }
      });
    }
  });

  ws.on("close", () => {
    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter(p => p !== ws);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
