using Focus.Api.Data;

namespace Focus.Api.Timers;

public class TimerSettings
{
    public int Id { get; set; } = 1;
    public int CheckSeconds { get; set; }
    public bool PromptSound { get; set; }
    public string PlaybackJson { get; set; } = "{}";
    public int SelectedSubjectId { get; set; } = 1;
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

    public List<AttentionCheck> Checks { get; set; } = [];
    public int CheckSeconds { get; set; }
    public long VerifiedThrough { get; set; }
    public long NextCheckRunningMs { get; set; }
    public long MakeupTargetMs { get; set; }
    public long? CountdownEnd { get; set; }
    public bool Interrupted { get; set; }
    public int? SubjectId { get; set; }
    public Subject? Subject { get; set; }
    public int? StudyDayId { get; set; }
    public StudyDay? StudyDay { get; set; }
    public string Title { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Tags { get; set; } = "";

    public int ExtensionSeconds { get; set; }
    public int StarterTargetSeconds { get; set; }
    public long RefocusUntilMs { get; set; }
    public int TargetSeconds => PlannedSeconds + ExtensionSeconds;

    public long RunningMs(long now) => Intervals.Where(i => i.Kind == "running").Sum(i => i.Duration(now));
    public long RemainingMs(long now)
    {
        var target = MakeupTargetMs > 0 ? MakeupTargetMs : TargetSeconds * 1000L;
        var elapsed = Intervals.Where(i => i.Kind == "running" && i.Makeup == (MakeupTargetMs > 0)).Sum(i => i.Duration(now));
        return Math.Max(0, target - elapsed);
    }
    public void OpenRunning(long at) => Intervals.Add(new BlockInterval
    {
        Start = at,
        Makeup = MakeupTargetMs > 0,
        Category = Mode == "break" ? "break" : CheckSeconds > 0 ? "unverified" : "focus"
    });
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
    public string Category { get; set; } = "";
    public bool Makeup { get; set; }
    public string Reason { get; set; } = "";
    public string Accounting(string mode) => Category.Length > 0 ? Category :
        Kind == "pause" ? "pause" : mode == "break" ? "break" : "focus";
    public long Duration(long now) => Math.Max(0, (End ?? now) - Start);
}

public record Playback(bool Bell = true, bool Notifications = false, bool Ticking = false,
    bool Rain = false, int TickVolume = 25, int RainVolume = 30, string Theme = "forest");

public record Preferences(int FocusSeconds, int BreakSeconds, bool Loop, bool AutoBreak, bool AutoFocus, int CheckSeconds = 0, bool PromptSound = false, Playback? Playback = null);
public record TimerCommand(long Revision, Preferences? Preferences = null,
    long OffMs = 0, string Reason = "", SessionInfo? Session = null, string Zone = "UTC",
    bool AllOff = false, int? BlockId = null);

public class AttentionCheck
{
    public int Id { get; set; }
    public int TimerBlockId { get; set; }
    public long ScheduledAt { get; set; }
    public long Boundary { get; set; }
    public long? AnsweredAt { get; set; }
    public string Answer { get; set; } = "";
}
