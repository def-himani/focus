namespace Focus.Api.Timers;

public class TimerSettings
{
    public int Id { get; set; } = 1;
    public long Revision { get; set; }
    public string Mode { get; set; } = "focus";
    public int FocusSeconds { get; set; } = 2400;
    public int BreakSeconds { get; set; } = 300;
    public bool Loop { get; set; } = true;
    public bool AutoBreak { get; set; } = true;
    public bool AutoFocus { get; set; } = true;
}

public class TimerBlock
{
    public int Id { get; set; }
    public string Mode { get; set; } = "focus";
    public string Status { get; set; } = "running";
    public int PlannedSeconds { get; set; }
    public long StartedAt { get; set; }
    public long? EndedAt { get; set; }
    public long LastObservedAt { get; set; }
    public List<BlockInterval> Intervals { get; set; } = [];

    public long RunningMs(long now) => Intervals.Where(i => i.Kind == "running").Sum(i => i.Duration(now));
    public long RemainingMs(long now) => Math.Max(0, PlannedSeconds * 1000L - RunningMs(now));
    public void CloseInterval(long at)
    {
        var open = Intervals.SingleOrDefault(i => i.End == null);
        if (open != null) open.End = Math.Max(open.Start, at);
    }
}

public class BlockInterval
{
    public int Id { get; set; }
    public int TimerBlockId { get; set; }
    public long Start { get; set; }
    public long? End { get; set; }
    public string Kind { get; set; } = "running";
    public long Duration(long now) => Math.Max(0, (End ?? now) - Start);
}

public record Preferences(int FocusSeconds, int BreakSeconds, bool Loop, bool AutoBreak, bool AutoFocus);
public record TimerCommand(long Revision, Preferences? Preferences = null);
