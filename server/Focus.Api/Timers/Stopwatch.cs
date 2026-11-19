using Focus.Api.Data;

namespace Focus.Api.Timers;

// Stopwatch intervals use the existing ledger so overlap checks and date reports share one clock.
internal static class Stopwatch
{
    public static void Open(TimerBlock block, long at)
    {
        block.Intervals.Add(new BlockInterval { Start = at, Category = "stopwatch" });
        block.Status = "running";
    }

    public static async Task Apply(FocusDbContext db, TimerBlock block, string action, long now)
    {
        switch (action)
        {
            case "watch-pause" when block.Status == "running":
                block.CloseInterval(now);
                block.Status = "paused";
                break;
            case "watch-resume" when block.Status == "paused":
                Open(block, now);
                break;
            case "watch-stop":
                block.CloseInterval(now);
                block.Status = "completed";
                block.EndedAt = now;
                block.Subject = await Journal.Resolve(db, new(Activity: "General Activity"));
                break;
            default:
                throw new InputError("Finish the current timer before starting another.");
        }
        block.LastObservedAt = now;
    }
}
