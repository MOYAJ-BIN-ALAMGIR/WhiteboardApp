using System;
using System.Linq;
using Microsoft.AspNetCore.SignalR;
using WhiteboardApp.Models;
using WhiteboardApp.Services;

namespace WhiteboardApp.Hubs
{
    public class WhiteboardHub : Hub
    {
        private readonly BoardState _board;

        public WhiteboardHub(BoardState board)
        {
            _board = board;
        }
        // Join or create a room. If roomId is empty, a new room code will be created.
        public async Task JoinRoom(string? roomId, string userName, string? password)
        {
            var created = false;

            if (string.IsNullOrWhiteSpace(roomId))
            {
                roomId = GenerateRoomCode();
            }

            var allowed = _board.TryEnterRoom(roomId, password, out created);
            if (!allowed)
            {
                await Clients.Caller.SendAsync("JoinFailed", new { reason = "Invalid password" });
                return;
            }

            // Add connection to SignalR group for the room
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

            // Acknowledge join and include room id
            await Clients.Caller.SendAsync("Joined", new
            {
                connectionId = Context.ConnectionId,
                userName = userName,
                roomId = roomId,
                created = created
            });

            // Send full room state to caller
            var all = _board.GetAll(roomId);
            await Clients.Caller.SendAsync("FullState", all);
        }

        public async Task SendDraw(DrawData data)
        {
            if (data == null) return;

            var roomId = data.RoomId ?? "__default";

            // Save segment in memory (per-room)
            _board.Add(roomId, data);

            // Broadcast to everyone in the same room except sender
            await Clients.GroupExcept(roomId, new[] { Context.ConnectionId }).SendAsync("ReceiveDraw", data);
        }

        public async Task ClearBoard(string? roomId)
        {
            var r = string.IsNullOrWhiteSpace(roomId) ? "__default" : roomId;
            _board.Clear(r);
            await Clients.Group(r).SendAsync("ReceiveClear");
        }

        private static string GenerateRoomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var rng = new Random();
            return new string(Enumerable.Range(0, 6).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
        }
    }
}
