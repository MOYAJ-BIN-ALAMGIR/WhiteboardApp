using WhiteboardApp.Models;

namespace WhiteboardApp.Services
{
    public class BoardState
    {
        // In-memory list of all segments on the board
        // Good enough for a project demo (not for huge boards/production).
        private readonly List<DrawData> _segments = new();
        private readonly object _lock = new();

        public void Add(DrawData seg)
        {
            lock (_lock)
            {
                _segments.Add(seg);

                // Safety cap to prevent memory growing forever in demos
                if (_segments.Count > 200_000)
                    _segments.RemoveRange(0, 50_000);
            }
        }

        public List<DrawData> GetAll()
        {
            lock (_lock)
            {
                return _segments.ToList();
            }
        }

        public void Clear()
        {
            lock (_lock)
            {
                _segments.Clear();
            }
        }
    }
}
