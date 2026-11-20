using Focus.Api.Timers;
using Focus.Api.Garden;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Data;

public record SubjectEdit(string Name, string Kind, int? EstimateMinutes = null, string State = "active", Guid? CreationKey = null);
public record PersonalEdit(Guid Id, long Start, long End, string Label);

public static class Journal
{
    public static IQueryable<TimerBlock> Detailed(FocusDbContext db) => db.Blocks
        .Include(b => b.StudyDay).Include(b => b.Subject).Include(b => b.Intervals).Include(b => b.Checks).Include(b => b.Adjustments).AsSplitQuery();

    private record Span(long Start, long End, string Category, bool Pause, bool Makeup, string Reason);
    // Allocate a stopwatch estimate to the latest measured time, skipping all paused gaps.
    private static IEnumerable<Span> Spans(TimerBlock b, long at)
    {
        var activityLeft = b.RunningMs(at) - b.StopwatchOffMs;
        foreach (var i in b.Intervals.OrderBy(i => i.Start).ThenBy(i => i.Id))
        {
            var end = i.End ?? at;
            if (b.Mode == "stopwatch" && b.StopwatchOffMs > 0)
            {
                var split = i.Start + Math.Min(activityLeft, end - i.Start);
                activityLeft -= split - i.Start;
                if (split > i.Start) yield return new(i.Start, split, "stopwatch", false, false, "");
                if (end > split) yield return new(split, end, "off-task", false, false, "Stopwatch correction");
            }
            else yield return new(i.Start, end, i.Accounting(b.Mode), i.Kind == "pause", i.Makeup, i.Reason);
        }
    }

    public static object Row(TimerBlock b) => RowAt(b, b.EndedAt ?? b.LastObservedAt);

    public static object RowAt(TimerBlock b, long at)
    {
        return new
        {
            b.Id,
            b.Mode,
            b.StartedAt,
            b.EndedAt,
            b.LastObservedAt,
            b.Status,
            b.PlannedSeconds,
            b.ExtensionSeconds,
            b.TargetSeconds,
            adjustments = b.Adjustments.OrderBy(a => a.RecordedAt).ThenBy(a => a.Id).Select(a => new { a.Id, a.Seconds, a.RecordedAt }),
            measuredMs = b.Mode == "stopwatch" ? b.RunningMs(at) : 0,
            subjectId = b.SubjectId ?? (b.Mode == "stopwatch" ? 0 : 1),
            subject = b.Subject?.Name ?? (b.Mode == "stopwatch" ? "Uncategorized" : "General Study"),
            b.StudyDayId,
            b.Title,
            b.Notes,
            b.Tags,
            b.CountdownEnd,
            b.MakeupTargetMs,
            b.Interrupted,
            effectiveMs = Attention.Total(b, "focus", at),
            offMs = b.Mode == "stopwatch" ? b.StopwatchOffMs : Attention.Total(b, "off-task", at),
            unverifiedMs = Attention.Total(b, "unverified", at),
            pausedMs = b.Intervals.Where(i => i.Kind == "pause").Sum(i => i.Duration(at)),
            pauseCount = b.Intervals.Count(i => i.Kind == "pause"),
            intervals = Spans(b, at),
            checks = b.Checks.OrderBy(c => c.ScheduledAt).Select(c => new { c.ScheduledAt, c.Boundary, c.AnsweredAt, c.Answer })
        };
    }

    public static string Text(string? value, int max)
    {
        var text = value?.Trim() ?? "";
        if (text.Length > max) throw new InputError($"Text exceeds {max} characters.");
        return text;
    }

    public static async Task<Subject> Resolve(FocusDbContext db, SessionInfo info, int? retainedSubjectId = null)
    {
        if (info.SubjectId is { } id)
        {
            var subject = await db.Subjects.FindAsync(id) ?? throw new InputError("Unknown subject.");
            if (subject.Id != retainedSubjectId && subject.State != "active") throw new InputError("Choose an active subject.");
            return subject;
        }
        var name = Text(info.Activity, 200);
        if (name.Length == 0) return await db.Subjects.FirstAsync(s => s.Id == 1);
        var key = name.ToUpperInvariant();
        var existing = await db.Subjects.FirstOrDefaultAsync(s => s.Kind == "activity" && s.State != "deleted" && s.NormalizedName == key);
        if (existing != null)
        {
            if (existing.Id != retainedSubjectId && existing.State != "active") throw new InputError("Restore the archived activity or choose another name.");
            return existing;
        }
        var activity = new Subject { Name = name, NormalizedName = key };
        db.Subjects.Add(activity);
        await db.SaveChangesAsync();
        return activity;
    }

    public static void Describe(TimerBlock b, SessionInfo info)
    {
        b.Title = Text(info.Title, 300);
        b.Notes = Text(info.Notes, 10000);
        b.Tags = Text(info.Tags, 500);
    }

    private static async Task<IResult> SaveSubject(int? id, SubjectEdit edit, FocusDbContext db)
    {
        using var tx = await db.Database.BeginTransactionAsync();
        var name = Text(edit.Name, 200);
        if (name.Length == 0 || edit.Kind is not ("todo" or "activity") ||
            edit.State is not ("active" or "completed" or "archived" or "deleted") || edit.EstimateMinutes is <= 0 ||
            edit.Kind == "activity" && (edit.EstimateMinutes != null || edit.State == "completed"))
            throw new InputError("Provide a name and a positive optional to-do estimate.");
        if (!id.HasValue && edit.CreationKey == null) throw new InputError("Missing creation key.");
        if (!id.HasValue && await db.Subjects.AnyAsync(s => s.CreationKey == edit.CreationKey))
            return Results.NoContent();
        var subject = id.HasValue ? await db.Subjects.FindAsync(id.Value) : new Subject { Kind = edit.Kind, CreationKey = edit.CreationKey };
        if (subject == null) return Results.NotFound();
        if (subject.Kind != edit.Kind) throw new InputError("Subject type cannot change.");
        if (subject.State == "deleted") return Results.NotFound();
        if (edit.State != "active" && (subject.Id == 1 || subject.Kind == "activity" && subject.NormalizedName == "GENERAL ACTIVITY"))
            throw new InputError("Keep the default activity available for new sessions.");
        var key = name.ToUpperInvariant();
        if (edit.Kind == "activity" && await db.Subjects.AnyAsync(s => s.Kind == "activity" && s.State != "deleted" && s.NormalizedName == key && s.Id != subject.Id))
            throw new InputError("An activity already uses that name.");
        subject.Name = name;
        subject.NormalizedName = key;
        subject.State = edit.State;
        subject.EstimateMinutes = edit.EstimateMinutes;
        if (!id.HasValue) db.Subjects.Add(subject);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Results.Ok(subject);
    }

    public static void MapJournal(this WebApplication app)
    {
        app.MapGet("/api/journal", async (FocusDbContext db, TimeProvider clock) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var blocks = await Detailed(db).AsNoTracking().OrderByDescending(b => b.StartedAt).ThenByDescending(b => b.Id).ToListAsync();
            return Results.Ok(new
            {
                sessions = blocks.Select(b => b.Mode == "stopwatch" && b.EndedAt == null
                    ? RowAt(b, Math.Max(b.LastObservedAt, clock.GetUtcNow().ToUnixTimeMilliseconds())) : Row(b)),
                subjects = await db.Subjects.OrderBy(s => s.Name).ToListAsync(),
                days = await db.StudyDays.OrderByDescending(d => d.Start).ToListAsync(),
                notes = await db.DailyNotes.ToListAsync(),
                personal = await db.PersonalIntervals.OrderBy(i => i.Start).ToListAsync()
            });
        });
        app.MapPost("/api/subjects", (SubjectEdit edit, FocusDbContext db) => SaveSubject(null, edit, db));
        app.MapPut("/api/subjects/{id:int}", (int id, SubjectEdit edit, FocusDbContext db) => SaveSubject(id, edit, db));
        app.MapPut("/api/sessions/{id:int}", async (int id, SessionInfo edit, FocusDbContext db) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var block = await db.Blocks.SingleOrDefaultAsync(b => b.Id == id && b.Mode == "focus");
            if (block == null) return Results.NotFound();
            block.Subject = await Resolve(db, edit, block.SubjectId);
            Describe(block, edit);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
        app.MapPut("/api/stopwatch/{id:int}/adjustments/{key:guid}", async (int id, Guid key, AddStopwatchTime edit, FocusDbContext db, TimeProvider clock) =>
        {
            if (key == Guid.Empty || edit.Seconds is not (30 or 60)) throw new InputError("Choose 30 seconds or one minute.");
            using var tx = await db.Database.BeginTransactionAsync();
            if (!await db.Blocks.AnyAsync(b => b.Id == id && b.Mode == "stopwatch")) return Results.NotFound();
            var adjustments = db.Set<StopwatchAdjustment>();
            var prior = await adjustments.FindAsync(key);
            if (prior != null) return prior.TimerBlockId == id && prior.Seconds == edit.Seconds ? Results.NoContent() : Results.Conflict();
            adjustments.Add(new() { Id = key, TimerBlockId = id, Seconds = edit.Seconds, RecordedAt = clock.GetUtcNow().ToUnixTimeMilliseconds() });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
        app.MapPut("/api/stopwatch/{id:int}", async (int id, SessionInfo edit, FocusDbContext db) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var block = await db.Blocks.Include(b => b.Intervals).SingleOrDefaultAsync(b => b.Id == id && b.Mode == "stopwatch" && b.EndedAt != null);
            if (block == null) return Results.NotFound();
            if (edit.StopwatchOffMs is long off)
            {
                if (off < 0 || off > block.RunningMs(block.EndedAt!.Value)) throw new InputError("Distracted time must fit within measured stopwatch time.");
                block.StopwatchOffMs = off;
            }
            block.Title = Text(edit.Title, 300);
            block.Notes = Text(edit.Notes, 10000);
            block.Subject = edit.SubjectId != null || !string.IsNullOrWhiteSpace(edit.Activity)
                ? await Resolve(db, edit, block.SubjectId) : null;
            if (block.Subject == null) block.SubjectId = null;
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
        app.MapDelete("/api/sessions/{id:int}", async (int id, FocusDbContext db, TimeProvider clock, GardenService garden) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var block = await db.Blocks.IgnoreQueryFilters().SingleOrDefaultAsync(b => b.Id == id);
            if (block == null || block.Mode == "break") return Results.NotFound();
            if (block.VoidedAt != null) return Results.NoContent();
            if (block.EndedAt == null) throw new InputError("Stop or discard the active timer first.");
            await garden.Reverse(id);
            block.VoidedAt = clock.GetUtcNow().ToUnixTimeMilliseconds();
            (await db.Settings.SingleAsync()).Revision++;
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
        app.MapPut("/api/daily-note", async (DailyNote edit, FocusDbContext db) =>
        {
            if (!DateOnly.TryParseExact(edit.Date, "yyyy-MM-dd", out _)) throw new InputError("Choose a calendar date.");
            using var tx = await db.Database.BeginTransactionAsync();
            var existing = await db.DailyNotes.FindAsync(edit.Date);
            var note = Text(edit.Note, 10000);
            if (existing != null && note.Length == 0) db.DailyNotes.Remove(existing);
            else if (existing != null) existing.Note = note;
            else if (note.Length > 0) db.DailyNotes.Add(new() { Date = edit.Date, Note = note });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
        app.MapPost("/api/personal", async (PersonalEdit edit, FocusDbContext db, TimeProvider clock) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var label = Text(edit.Label, 100);
            var now = clock.GetUtcNow().ToUnixTimeMilliseconds();
            if (edit.Id == Guid.Empty || label.Length == 0 || edit.Start < 0 || edit.Start >= edit.End || edit.End > now)
                throw new InputError("Choose a label and a completed time range.");
            if (await db.PersonalIntervals.FindAsync(edit.Id) != null) return Results.NoContent();
            if (await db.PersonalIntervals.AnyAsync(i => i.Start < edit.End && i.End > edit.Start) ||
                await db.Blocks.SelectMany(b => b.Intervals).AnyAsync(i => i.Start < edit.End && (i.End ?? now) > edit.Start))
                throw new InputError("That range overlaps a recorded interval. Choose an uncovered range.");
            db.PersonalIntervals.Add(new() { Id = edit.Id, Start = edit.Start, End = edit.End, Label = label });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
    }
}
