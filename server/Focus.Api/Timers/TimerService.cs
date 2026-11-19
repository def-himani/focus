using Focus.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Timers;

public sealed class TimerService(FocusDbContext db, TimeProvider clock)
{
    private Task<TimerBlock?> Active() => db.Blocks.Include(b => b.Intervals)
        .SingleOrDefaultAsync(b => b.EndedAt == null);

    public async Task<IResult> Read()
    {
        using var transaction = await db.Database.BeginTransactionAsync();
        var settings = await db.Settings.SingleAsync();
        return await Snapshot(settings, await Active(), clock.GetUtcNow().ToUnixTimeMilliseconds());
    }

    public async Task<IResult> Apply(string action, TimerCommand request)
    {
        // SQLite's immediate transaction serializes the revision check and every resulting write.
        using var transaction = await db.Database.BeginTransactionAsync();
        var settings = await db.Settings.SingleAsync();
        if (request.Revision != settings.Revision) return Results.Conflict();
        var block = await Active();
        var now = Math.Max(clock.GetUtcNow().ToUnixTimeMilliseconds(), block?.LastObservedAt ?? 0);
        var running = block?.Status == "running";
        var changed = action is not ("attach" or "sync");
        if (action is not ("attach" or "sync" or "start" or "resume" or "stop" or "reset" or "pause" or "settings" or "skip"))
            return Results.BadRequest("Unknown timer action.");
        if (action == "settings" && (request.Preferences is not {} prefs ||
            prefs.FocusSeconds is < 1 or > 86400 || prefs.BreakSeconds is < 1 or > 86400))
            return Results.BadRequest("Choose a duration between one second and 24 hours.");
        if (action == "settings" && request.Preferences is {} p)
        {
            settings.FocusSeconds = p.FocusSeconds;
            settings.BreakSeconds = p.BreakSeconds;
            settings.Loop = p.Loop;
            settings.AutoBreak = p.AutoBreak;
            settings.AutoFocus = p.AutoFocus;
        }

        if (action == "attach" && running)
        {
            // A fresh page cannot vouch for time since the last successful observation.
            block!.CloseInterval(block.LastObservedAt);
            block.Intervals.Add(new BlockInterval { Kind = "pause", Start = now });
            block.Status = "paused";
            changed = true;
        }
        else if (running && block!.RemainingMs(now) == 0)
        {
            var deadline = block.LastObservedAt + block.RemainingMs(block.LastObservedAt);
            Finish(block, deadline, "completed");
            if (action is "stop" or "reset")
            {
                block = null;
                settings.Mode = "focus";
            }
            else
            {
                block = Advance(settings, now);
            }
            changed = true;
        }
        else
        {
            switch (action)
            {
                case "attach":
                case "sync":
                case "settings":
                    break;
                case "start" when block == null:
                    block = Start(settings, now);
                    break;
                case "pause" when running:
                    block!.CloseInterval(now);
                    block.Intervals.Add(new BlockInterval { Kind = "pause", Start = now });
                    block.Status = "paused";
                    break;
                case "resume" when block?.Status == "paused":
                    block.CloseInterval(now);
                    block.Intervals.Add(new BlockInterval { Start = now });
                    block.Status = "running";
                    break;
                case "stop" when block?.Mode == "focus":
                case "reset" when block != null:
                    Finish(block, now, "partial");
                    settings.Mode = "focus";
                    block = null;
                    break;
                case "skip" when settings.Mode == "break":
                    if (block != null) Finish(block, now, "partial");
                    block = Advance(settings, now);
                    break;
                case "reset" when settings.Mode == "break":
                    settings.Mode = "focus";
                    break;
                default:
                    return Results.BadRequest("Action unavailable in the current timer state.");
            }
        }

        if (block != null) block.LastObservedAt = now;
        if (changed)
            settings.Revision++;

        await db.SaveChangesAsync();
        var result = await Snapshot(settings, block, now);
        await transaction.CommitAsync();
        return result;
    }

    private TimerBlock Start(TimerSettings settings, long now)
    {
        var block = new TimerBlock
        {
            Mode = settings.Mode,
            PlannedSeconds = settings.Mode == "focus" ? settings.FocusSeconds : settings.BreakSeconds,
            StartedAt = now, LastObservedAt = now,
            Intervals = [new BlockInterval { Start = now }]
        };
        db.Blocks.Add(block);
        return block;
    }

    private static void Finish(TimerBlock block, long at, string status)
    {
        block.CloseInterval(at);
        block.EndedAt = at;
        block.LastObservedAt = at;
        block.Status = status;
    }

    private TimerBlock? Advance(TimerSettings settings, long now)
    {
        if (settings.Mode == "focus" && (settings.Loop || settings.AutoBreak))
        {
            settings.Mode = "break";
            return settings.AutoBreak ? Start(settings, now) : null;
        }
        var repeat = settings.Mode == "break" && settings.Loop && settings.AutoFocus;
        settings.Mode = "focus";
        return repeat ? Start(settings, now) : null;
    }

    private async Task<IResult> Snapshot(TimerSettings settings, TimerBlock? block, long now)
    {
        var history = await db.Blocks.AsNoTracking().Include(b => b.Intervals)
            .Where(b => b.Mode == "focus" && b.EndedAt != null)
            .OrderByDescending(b => b.EndedAt).ThenByDescending(b => b.Id).Take(10).ToListAsync();
        var planned = block?.PlannedSeconds ??
            (settings.Mode == "focus" ? settings.FocusSeconds : settings.BreakSeconds);
        return Results.Ok(new
        {
            settings.Revision, settings.Mode, status = block?.Status ?? "idle",
            plannedSeconds = planned, remainingMs = block?.RemainingMs(now) ?? planned * 1000L,
            preferences = new Preferences(settings.FocusSeconds, settings.BreakSeconds,
                settings.Loop, settings.AutoBreak, settings.AutoFocus),
            history = history.Select(b => new
            {
                b.Id, b.StartedAt, b.EndedAt, b.Status, b.PlannedSeconds,
                effectiveMs = b.RunningMs(b.EndedAt!.Value),
                pausedMs = b.Intervals.Where(i => i.Kind == "pause").Sum(i => i.Duration(b.EndedAt.Value))
            })
        });
    }
}
