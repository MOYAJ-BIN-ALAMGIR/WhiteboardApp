using WhiteboardApp.Models;

namespace WhiteboardApp.Services
{
    public class BoardState
    {
        // Per-room in-memory state. Each room has its own list and optional password.
        private class RoomState
        {
            public List<DrawData> Segments { get; } = new();
            public string? Password { get; set; }
            public object Lock { get; } = new();
        }

        private readonly Dictionary<string, RoomState> _rooms = new(StringComparer.OrdinalIgnoreCase);
        private readonly object _roomsLock = new();

        private RoomState EnsureRoom(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId)) roomId = "__default";

            lock (_roomsLock)
            {
                if (!_rooms.TryGetValue(roomId, out var room))
                {
                    room = new RoomState();
                    _rooms[roomId] = room;
                }

                return room;
            }
        }

        // Try to enter or create a room. Returns true if allowed. 'created' indicates whether room was created now.
        public bool TryEnterRoom(string roomId, string? password, out bool created)
        {
            created = false;
            if (string.IsNullOrWhiteSpace(roomId)) roomId = "__default";

            lock (_roomsLock)
            {
                if (!_rooms.TryGetValue(roomId, out var room))
                {
                    // create new room with optional password
                    room = new RoomState { Password = password };
                    _rooms[roomId] = room;
                    created = true;
                    return true;
                }

                // existing room: if password set, require match
                if (!string.IsNullOrEmpty(room.Password))
                {
                    return string.Equals(room.Password, password ?? string.Empty, StringComparison.Ordinal);
                }

                return true;
            }
        }

        public void Add(string roomId, DrawData seg)
        {
            var room = EnsureRoom(roomId);
            lock (room.Lock)
            {
                room.Segments.Add(seg);

                if (room.Segments.Count > 200_000)
                    room.Segments.RemoveRange(0, 50_000);
            }
        }

        public List<DrawData> GetAll(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId)) roomId = "__default";

            lock (_roomsLock)
            {
                if (!_rooms.TryGetValue(roomId, out var room)) return new List<DrawData>();
                lock (room.Lock) return room.Segments.ToList();
            }
        }

        public void Clear(string roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId)) roomId = "__default";

            lock (_roomsLock)
            {
                if (_rooms.TryGetValue(roomId, out var room))
                {
                    lock (room.Lock) room.Segments.Clear();
                }
            }
        }
    }
}
