using Focus.Api.Data;

namespace Focus.Api.Timers;

public static class Attention
{
    public static long Total(TimerBlock b, string category, long at) =>
        b.Intervals.Where(i => i.Accounting(b.Mode) == category).Sum(i => i.Duration(at));

    public static bool Schedule(TimerBlock b, long at)
    {
        if (b.CheckSeconds == 0 || b.Checks.Any(c => c.AnsweredAt == null) ||
            b.RunningMs(at) < b.NextCheckRunningMs) return false;
        // Translate elapsed running time to a wall-clock timestamp across explicit pauses.
        var left = b.NextCheckRunningMs;
        foreach (var i in b.Intervals.Where(i => i.Kind == "running").OrderBy(i => i.Start))
        {
            if (left <= i.Duration(at))
            {
                b.Checks.Add(new AttentionCheck { ScheduledAt = i.Start + left, Boundary = b.VerifiedThrough });
                return true;
            }
            left -= i.Duration(at);
        }
        return false;
    }

    public static void Classify(TimerBlock b, TimerCommand request, long at, bool answer)
    {
        var running = b.Status == "running";
        if (running) b.CloseInterval(at);
        // A stand-alone report only touches the latest contiguous eligible run.
        // A review explicitly classifies all unresolved running intervals, newest off-task first.
        var candidates = b.Intervals.Where(i => i.Kind == "running" && i.Duration(at) > 0)
            .OrderByDescending(i => i.Start).ToList();
        if (answer)
            candidates.RemoveAll(i => i.Accounting(b.Mode) != "unverified");
        else
            candidates = candidates.Take(1).Where(i => i.Start >= b.VerifiedThrough &&
                i.Accounting(b.Mode) is "focus" or "unverified" && i.End == at).ToList();
        var eligible = candidates.Sum(i => i.Duration(at));
        var off = request.AllOff ? eligible : request.OffMs;
        if (off < 0 || off > eligible || (!answer && off == 0))
            throw new InputError("The report exceeds the available running time. Use a shorter duration; pauses and previously reviewed time are excluded.");
        foreach (var interval in candidates)
        {
            var duration = interval.Duration(at);
            var tail = Math.Min(off, duration);
            if (answer) interval.Category = "focus";
            if (tail == duration) interval.Category = "off-task";
            else if (tail > 0)
            {
                var end = interval.End!.Value;
                interval.End = end - tail;
                b.Intervals.Add(new BlockInterval { Start = end - tail, End = end, Category = "off-task", Makeup = interval.Makeup, Reason = "Reported distraction" });
            }
            if (tail == duration) interval.Reason = "Reported distraction";
            off -= tail;
        }
        if (answer)
        {
            var check = b.Checks.SingleOrDefault(c => c.AnsweredAt == null);
            if (check == null)
            {
                check = new AttentionCheck { ScheduledAt = b.Status == "review" ? b.LastObservedAt : at, Boundary = b.VerifiedThrough };
                b.Checks.Add(check);
            }
            check.AnsweredAt = at;
            check.Answer = request.AllOff ? "Off-task" : request.OffMs > 0 ? "Mixed" : "Focused";
            b.VerifiedThrough = candidates.Count == 0 ? b.VerifiedThrough : candidates.Max(i => i.End ?? at);
            if (b.Status == "review") b.VerifiedThrough = b.Intervals.Max(i => i.End ?? at);
            else if (running) b.VerifiedThrough = at;
            b.NextCheckRunningMs = b.RunningMs(at) + b.CheckSeconds * 1000L;
        }
        if (running) b.OpenRunning(at);
    }
}
