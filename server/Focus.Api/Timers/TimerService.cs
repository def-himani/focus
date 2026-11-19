using Focus.Api.Data;
using Focus.Api.Garden;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Timers;

public sealed class TimerService(FocusDbContext db, TimeProvider clock, GardenService garden)
{
    private IQueryable<TimerBlock> Open => Journal.Detailed(db).Where(b => b.EndedAt == null)
        .OrderBy(b => b.StartedAt).ThenBy(b => b.Id);

    public async Task<IResult> Read()
    {
        using var tx = await db.Database.BeginTransactionAsync();
        return await Snapshot(await db.Settings.SingleAsync(), await Open.FirstOrDefaultAsync(), clock.GetUtcNow().ToUnixTimeMilliseconds());
    }

    public async Task<IResult> Apply(string action, TimerCommand cmd)
    {
        using var tx = await db.Database.BeginTransactionAsync();
        var settings = await db.Settings.SingleAsync();
        if (cmd.Revision != settings.Revision) return Results.Conflict();
        var open = await Open.ToListAsync();
        var block = cmd.BlockId is { } id ? open.FirstOrDefault(b => b.Id == id) : open.FirstOrDefault();
        if (cmd.BlockId.HasValue && block == null) return Results.Conflict();
        var now = Math.Max(clock.GetUtcNow().ToUnixTimeMilliseconds(), block?.LastObservedAt ?? 0);
        if (block != null && block.StudyDayId == null)
            block.StudyDay = await GetDay(block.StartedAt, cmd.Zone);
        var original = block;
        var priorMode = settings.Mode;
        var playbackSettings = JsonSerializer.Deserialize<Playback>(settings.PlaybackJson) ?? new();
        string? spoken = null;
        bool freshCompletion = false;
        string? completion = null;
        var changed = action is not ("sync" or "attach");
        if (action == "settings")
        {
            var p = cmd.Preferences ?? throw new InputError("Missing preferences.");
            if (p.FocusSeconds is < 1 or > 86400 || p.BreakSeconds is < 1 or > 86400 || p.CheckSeconds is < 0 or > 86400)
                throw new InputError("Choose a duration up to 24 hours.");
            if (p.Playback is { } playback)
            {
                if (playback.TickVolume is < 0 or > 100 || playback.RainVolume is < 0 or > 100 ||
                    playback.AlertVolume is < 0 or > 100 || playback.VoiceVolume is < 0 or > 100 ||
                    playback.Theme is not ("forest" or "slate" or "plum")) throw new InputError("Invalid sound or theme preference.");
                settings.PlaybackJson = JsonSerializer.Serialize(playback);
            }
            settings.PromptSound = p.PromptSound;
            (settings.FocusSeconds, settings.BreakSeconds, settings.Loop, settings.AutoBreak, settings.AutoFocus, settings.CheckSeconds) =
                (p.FocusSeconds, p.BreakSeconds, p.Loop, p.AutoBreak, p.AutoFocus, p.CheckSeconds);
        }

        if (block?.Mode == "stopwatch" || action == "watch-start")
        {
            if (action == "watch-start")
            {
                if (open.Count != 0 || settings.Mode != "focus")
                    throw new InputError("Finish the current timer before starting a stopwatch.");
                block = new TimerBlock { Mode = "stopwatch", StartedAt = now, LastObservedAt = now, StudyDay = await GetDay(now, cmd.Zone) };
                Stopwatch.Open(block, now);
                db.Blocks.Add(block);
            }
            else if (action is not ("sync" or "attach" or "settings"))
                await Stopwatch.Apply(db, block!, action, now);
            if (changed) settings.Revision++;
            await db.SaveChangesAsync();
            var snapshot = await Snapshot(settings, block?.EndedAt == null ? block : null, now);
            await tx.CommitAsync();
            return snapshot;
        }

        if (action == "done")
        {
            if (open.Any(b => b.Interrupted)) throw new InputError("Resolve interrupted sessions first.");
            var day = db.StudyDays.Local.FirstOrDefault(d => d.End == null) ?? await db.StudyDays.SingleOrDefaultAsync(d => d.End == null);
            if (day != null) day.End = now;
            if (block != null)
            {
                var expiry = block.LastObservedAt + block.RemainingMs(block.LastObservedAt);
                var at = block.Status switch
                {
                    "choice" or "review" or "starter-ended" => LastIntervalEnd(block),
                    "running" => Math.Min(now, expiry),
                    _ => now
                };
                block.CloseInterval(at);
                if (block.RemainingMs(at) == 0) block.CountdownEnd ??= at;
                if (Attention.Total(block, "unverified", at) > 0) block.Status = "review";
                else
                {
                    Finish(block, at, block.RemainingMs(at) == 0 ? "completed" : "partial");
                    block = null;
                }
            }
            settings.Mode = "focus";
        }
        else if (action == "attach" && open.Any(b => b.Status == "running"))
        {
            foreach (var interrupted in open.Where(b => b.Status == "running"))
            {
                var checkpoint = interrupted.LastObservedAt;
                var deadline = checkpoint + interrupted.RemainingMs(checkpoint);
                if (interrupted.Checks.Any(c => c.AnsweredAt == null) && now >= deadline)
                {
                    interrupted.CloseInterval(deadline);
                    interrupted.CountdownEnd ??= deadline;
                    interrupted.Status = "review";
                }
                else
                {
                    interrupted.CloseInterval(checkpoint);
                    interrupted.Interrupted = true;
                    interrupted.Status = "paused";
                }
            }
            changed = true;
        }
        else if (block?.Status == "running" && block.RemainingMs(now) == 0)
        {
            var deadline = block.LastObservedAt + block.RemainingMs(block.LastObservedAt);
            freshCompletion = now - deadline <= 5000;
            completion = block.MakeupTargetMs > 0 ? "Make-up" : block.Mode == "break" ? "Break" : "Focus";
            block.CloseInterval(deadline);
            block.CountdownEnd ??= deadline;
            Attention.Schedule(block, deadline);
            // A click in flight at expiry may concern the session that just ended.
            // Reclassify its closed ledger before considering an automatic successor.
            if (action == "distraction" && block.Mode == "focus")
            {
                block.Status = "review";
                Attention.Classify(block, cmd, deadline, false);
            }
            if (action == "answer" && block.Checks.Any(c => c.AnsweredAt == null))
            {
                block.Status = "review";
                Attention.Classify(block, cmd, now, true);
            }
            block = await AfterCountdown(settings, block, now, action is "stop" or "reset");
            changed = true;
        }
        else
        {
            if (block?.Status == "running")
            {
                changed |= Attention.Schedule(block, now);
                spoken = RemainingCue(block, now, playbackSettings);
            }
            switch (action)
            {
                case "settings": case "sync": case "attach": break;
                case "start" when block == null:
                    block = await Start(settings, now, cmd.Session, cmd.Zone);
                    break;
                case "quick" when block == null && settings.Mode == "focus":
                    block = await Start(settings, now, cmd.Session, cmd.Zone);
                    block.StarterTargetSeconds = Math.Max(120, settings.FocusSeconds);
                    block.PlannedSeconds = 120;
                    break;
                case "continue" when block?.StarterTargetSeconds > 120 && !block.Interrupted &&
                    block.Status is "running" or "paused" or "starter-ended" or "choice":
                    block.ExtensionSeconds = block.StarterTargetSeconds - block.PlannedSeconds;
                    block.StarterTargetSeconds = 0;
                    if (block.Status is "starter-ended" or "choice")
                    {
                        block.CountdownEnd = null;
                        block.Status = "running";
                        block.OpenRunning(now);
                    }
                    break;
                case "extend" when block?.Mode == "focus" && block.Status == "running" &&
                    block.StarterTargetSeconds == 0 && block.MakeupTargetMs == 0 && block.RemainingMs(now) <= 300000 &&
                    block.TargetSeconds <= 86100:
                    block.ExtensionSeconds += 300;
                    break;
                case "refocus" when block?.Mode == "focus" && block.Status == "running" && Attention.Total(block, "off-task", now) > 0:
                    block.RefocusUntilMs = block.RunningMs(now) + Math.Min(120000, block.RemainingMs(now));
                    break;
                case "pause" when block?.Status == "running":
                    block.CloseInterval(now);
                    block.Intervals.Add(new BlockInterval { Kind = "pause", Start = now, Makeup = block.MakeupTargetMs > 0 });
                    block.Status = "paused";
                    break;
                case "classify-pause" when block?.Status == "paused" && !block.Interrupted:
                    if (cmd.Reason is not ("Off-task" or "Necessary interruption" or "Rest" or "")) throw new InputError("Unknown pause reason.");
                    var pause = block.Intervals.Single(i => i.End == null);
                    pause.Reason = cmd.Reason;
                    pause.Category = cmd.Reason == "Off-task" ? "off-task" : "pause";
                    break;
                case "resume" when block?.Status == "paused":
                    if (open.Count > 1) throw new InputError("Close other interrupted sessions before resuming.");
                    block.CloseInterval(now);
                    block.Interrupted = false;
                    block.OpenRunning(now);
                    block.Status = "running";
                    break;
                case "distraction" when block?.Mode == "focus" && block.Status == "running":
                    Attention.Classify(block, cmd, now, false);
                    break;
                case "answer" when block != null && (block.Status == "review" || block.Checks.Any(c => c.AnsweredAt == null)):
                    Attention.Classify(block, cmd, now, true);
                    if (block.Status == "review")
                    {
                        if (block.RemainingMs(now) > 0 || block.StudyDay?.End != null)
                        {
                            Finish(block, LastIntervalEnd(block), block.RemainingMs(now) == 0 ? "completed" : "partial");
                            block = null;
                            settings.Mode = "focus";
                        }
                        else block = await AfterCountdown(settings, block, now, false);
                    }
                    break;
                case "makeup" when block?.Status == "choice":
                    block.StarterTargetSeconds = 0;
                    block.ReminderMask = 0;
                    block.MakeupTargetMs = block.TargetSeconds * 1000L - Attention.Total(block, "focus", now);
                    block.Status = "running";
                    block.NextCheckRunningMs = block.RunningMs(now) + block.CheckSeconds * 1000L;
                    block.OpenRunning(now);
                    break;
                case "finish" when block?.Status is "choice" or "starter-ended":
                    Finish(block, LastIntervalEnd(block), "completed");
                    block = await Advance(settings, now);
                    break;
                case "close-all" when open.Any(b => b.Interrupted):
                    foreach (var item in open.Where(b => b.Interrupted)) Finish(item, LastIntervalEnd(item), "partial");
                    block = open.FirstOrDefault(b => b.EndedAt == null);
                    settings.Mode = block?.Mode ?? "focus";
                    break;
                case "stop" when block?.Mode == "focus" && block.Status is "running" or "paused":
                case "reset" when block?.Status is "running" or "paused":
                    if (!block.Interrupted && block.Mode == "focus" && Attention.Total(block, "unverified", now) > 0)
                    {
                        block.CloseInterval(now);
                        block.Status = "review";
                        break;
                    }
                    Finish(block, block.Interrupted ? LastIntervalEnd(block) : now, "partial");
                    block = open.FirstOrDefault(b => b.EndedAt == null);
                    settings.Mode = block?.Mode ?? "focus";
                    break;
                case "skip" when settings.Mode == "break" && block?.Interrupted != true:
                    if (block != null) Finish(block, now, "partial");
                    block = await Advance(settings, now);
                    break;
                case "reset" when settings.Mode == "break": settings.Mode = "focus"; break;
                default: throw new InputError("Action unavailable in the current timer state.");
            }
        }

        if (block != null && !block.Interrupted)
            block.LastObservedAt = block.Status is "review" or "choice" or "starter-ended" ? LastIntervalEnd(block) : now;
        if (changed) settings.Revision++;
        await db.SaveChangesAsync();
        long earnedCoins = 0;
        foreach (var finished in open.Where(b => b.EndedAt.HasValue))
            earnedCoins += await garden.Settle(finished);
        if (block?.Status != "running" || action is "pause" or "reset" or "done") spoken = null;
        if (playbackSettings.SpeakTransitions)
        {
            var phrases = new List<string>();
            if (completion != null && freshCompletion) phrases.Add(completion + (completion == "Focus" ? " session complete." : " complete."));
            if (block?.Mode == "break" && block != original && block.Status == "running") phrases.Add("Break started.");
            else if (settings.Mode == "break" && block == null && priorMode != "break") phrases.Add("Break ready. Press Start break.");
            if (phrases.Count > 0) spoken = string.Join(" ", phrases);
        }
        var result = await Snapshot(settings, block, now, completion, earnedCoins, spoken, freshCompletion);
        await tx.CommitAsync();
        return result;
    }

    private static (int Minutes, int Bit, bool Enabled)[] Thresholds(Playback prefs) =>
        [(10, 1, prefs.RemindTen), (5, 2, prefs.RemindFive), (1, 4, prefs.RemindOne)];

    // One durable bit per threshold. Crossing while disabled or suspended consumes it too.
    private static string? RemainingCue(TimerBlock block, long now, Playback prefs)
    {
        var left = block.RemainingMs(now);
        var previous = block.RemainingMs(block.LastObservedAt);
        string? cue = null;
        foreach (var (minutes, bit, enabled) in Thresholds(prefs))
        {
            var threshold = minutes * 60000L;
            if ((block.ReminderMask & bit) != 0 || previous < threshold || left > threshold) continue;
            block.ReminderMask |= bit;
            if (enabled && threshold - left <= 5000 && left > 0)
                cue = minutes == 1 ? "One minute remaining." : $"{minutes} minutes remaining.";
        }
        return cue;
    }

    private static long LastIntervalEnd(TimerBlock b) => b.Intervals.Max(i => i.End ?? i.Start);

    private async Task<TimerBlock?> AfterCountdown(TimerSettings settings, TimerBlock b, long now, bool stop)
    {
        if (b.Mode == "focus" && Attention.Total(b, "unverified", now) > 0)
        {
            b.Status = "review";
            return b;
        }
        if (!stop && b.Mode == "focus" && b.MakeupTargetMs == 0 && Attention.Total(b, "focus", now) < b.TargetSeconds * 1000L)
        {
            b.Status = "choice";
            return b;
        }
        if (!stop && b.StarterTargetSeconds > 120 && b.MakeupTargetMs == 0)
        {
            b.Status = "starter-ended";
            return b;
        }
        Finish(b, LastIntervalEnd(b), "completed");
        if (!stop) return await Advance(settings, now);
        settings.Mode = "focus";
        return null;
    }

    private async Task<TimerBlock> Start(TimerSettings settings, long now, SessionInfo? info = null, string zone = "UTC")
    {
        var day = await GetDay(now, zone);
        var subject = info != null ? await Journal.Resolve(db, info) : await db.Subjects.FindAsync(settings.SelectedSubjectId);
        if (subject?.State != "active") subject = await db.Subjects.FindAsync(1);
        settings.SelectedSubjectId = subject!.Id;
        var check = settings.Mode == "focus" ? settings.CheckSeconds : 0;
        var b = new TimerBlock
        {
            Mode = settings.Mode,
            PlannedSeconds = settings.Mode == "focus" ? settings.FocusSeconds : settings.BreakSeconds,
            StartedAt = now,
            LastObservedAt = now,
            VerifiedThrough = now,
            StudyDay = day,
            Subject = subject,
            CheckSeconds = check,
            NextCheckRunningMs = check * 1000L
        };
        Journal.Describe(b, info ?? new());
        b.OpenRunning(now);
        db.Blocks.Add(b);
        return b;
    }

    private async Task<StudyDay> GetDay(long now, string zone)
    {
        var day = db.StudyDays.Local.FirstOrDefault(d => d.End == null) ?? await db.StudyDays.SingleOrDefaultAsync(d => d.End == null);
        if (day == null)
        {
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(zone, out var tz)) throw new InputError("Unknown time zone.");
            day = new StudyDay
            {
                Start = now,
                Zone = zone,
                Label = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeMilliseconds(now), tz).ToString("yyyy-MM-dd")
            };
            db.StudyDays.Add(day);
        }
        return day;
    }

    private static void Finish(TimerBlock b, long at, string status)
    {
        b.CloseInterval(at);
        b.EndedAt = at;
        b.Status = status;
        b.Interrupted = false;
    }

    private async Task<TimerBlock?> Advance(TimerSettings settings, long now)
    {
        if (settings.Mode == "focus" && (settings.Loop || settings.AutoBreak))
        {
            settings.Mode = "break";
            return settings.AutoBreak ? await Start(settings, now) : null;
        }
        var repeat = settings.Mode == "break" && settings.Loop && settings.AutoFocus;
        settings.Mode = "focus";
        return repeat ? await Start(settings, now) : null;
    }

    private async Task<IResult> Snapshot(TimerSettings s, TimerBlock? b, long now, string? completion = null, long earnedCoins = 0, string? spoken = null, bool freshCompletion = false)
    {
        var watch = b?.Mode == "stopwatch" ? b : null;
        if (watch != null) b = null;
        var history = await Journal.Detailed(db).AsNoTracking().Where(x => x.Mode == "focus" && x.EndedAt != null)
            .OrderByDescending(x => x.EndedAt).ThenByDescending(x => x.Id).Take(10).ToListAsync();
        var playback = JsonSerializer.Deserialize<Playback>(s.PlaybackJson) ?? new();
        long? nextReminderMs = null;
        if (b?.Status == "running")
        {
            var left = b.RemainingMs(now);
            nextReminderMs = Thresholds(playback)
                .Where(t => t.Enabled && (b.ReminderMask & t.Bit) == 0 && left >= t.Minutes * 60000L)
                .Select(t => (long?)(left - t.Minutes * 60000L)).Min();
        }
        var planned = b?.PlannedSeconds ?? (s.Mode == "focus" ? s.FocusSeconds : s.BreakSeconds);
        return Results.Ok(new
        {
            stopwatch = watch == null ? null : Journal.RowAt(watch, Math.Max(watch.LastObservedAt, now)),
            cueAt = now,
            spoken,
            freshCompletion,
            nextReminderMs,
            completion,
            earnedCoins,
            nextCoinMs = b?.Mode == "focus" && b.Status == "running" && b.RemainingMs(now) <= 300000
                ? (long?)await garden.UntilNextCoin(Attention.Total(b, "focus", now)) : null,
            targetSeconds = b?.TargetSeconds ?? planned,
            starterTarget = b?.StarterTargetSeconds ?? 0,
            refocusMs = b == null ? 0 : Math.Max(0, b.RefocusUntilMs - b.RunningMs(now)),
            s.Revision,
            s.Mode,
            status = b?.Status ?? "idle",
            plannedSeconds = planned,
            nextCheckMs = b?.Status == "running" && b.CheckSeconds > 0 && !b.Checks.Any(c => c.AnsweredAt == null)
                ? (long?)Math.Max(0, b.NextCheckRunningMs - b.RunningMs(now)) : null,
            remainingMs = b?.RemainingMs(now) ?? planned * 1000L,
            phaseTargetMs = b?.MakeupTargetMs > 0 ? b.MakeupTargetMs : (b?.TargetSeconds ?? planned) * 1000L,
            active = b == null ? null : Journal.RowAt(b, b.Status == "paused" && !b.Interrupted ? now : b.LastObservedAt),
            s.SelectedSubjectId,
            recoveries = await db.Blocks.Where(x => x.Interrupted && x.EndedAt == null).Select(x => new { x.Id, x.Title, x.StartedAt }).ToListAsync(),
            preferences = new Preferences(s.FocusSeconds, s.BreakSeconds, s.Loop, s.AutoBreak, s.AutoFocus, s.CheckSeconds, s.PromptSound, playback),
            history = history.Select(Journal.Row)
        });
    }
}
