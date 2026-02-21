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

        // Called by clients to sync their identity (optional)
        public async Task Join(string userName)
        {
            // Send connection info back only to caller (optional UI use)
            await Clients.Caller.SendAsync("Joined", new
            {
                connectionId = Context.ConnectionId,
                userName = userName
            });

            // Send full current board to caller (late joiner sync)
            var all = _board.GetAll();
            await Clients.Caller.SendAsync("FullState", all);
        }

        public async Task SendDraw(DrawData data)
        {
            // Save segment in memory
            _board.Add(data);

            // Broadcast to everyone except sender
            await Clients.Others.SendAsync("ReceiveDraw", data);
        }

        public async Task ClearBoard()
        {
            _board.Clear();
            await Clients.All.SendAsync("ReceiveClear");
        }
    }
}
