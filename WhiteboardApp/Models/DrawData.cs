namespace WhiteboardApp.Models
{
    public class DrawData
    {
        public float FromX { get; set; }
        public float FromY { get; set; }
        public float ToX { get; set; }
        public float ToY { get; set; }

        public string? Color { get; set; }
        public float Size { get; set; } = 2;
        public bool IsStart { get; set; } // optional
        public string? UserName { get; set; } // NEW
        // Optional room identifier (null or empty = global/default)
        public string? RoomId { get; set; }
    }
}
