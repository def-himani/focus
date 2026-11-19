using Focus.Api.Timers;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Data;

public record SubjectEdit(string Name, string Kind, int? EstimateMinutes = null, string State = "active", Guid? CreationKey = null);
public record PersonalEdit(Guid Id, long Start, long End, string Label);

public static class Journal
{
    public static IQueryable<TimerBlock> Detailed(FocusDbContext db) => db.Blocks
        .Include(b => b.StudyDay).Include(b => b.Subject).Include(b => b.Intervals).Include(b => b.Checks).AsSplitQuery();

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
            subjectId = b.SubjectId ?? 1,
            subject = b.Subject?.Name ?? "General Study",
            b.StudyDayId,
            b.Title,
            b.Notes,
            b.Tags,
            b.CountdownEnd,
            b.MakeupTargetMs,
            b.Interrupted,
            effectiveMs = Attention.Total(b, "focus", at),
            offMs = Attention.Total(b, "off-task", at),
            unverifiedMs = Attention.Total(b, "unverified", at),
            pausedMs = b.Intervals.Where(i => i.Kind == "pause").Sum(i => i.Duration(at)),
            pauseCount = b.Intervals.Count(i => i.Kind == "pause"),
            intervals = b.Intervals.OrderBy(i => i.Start).Select(i => new
            { i.Start, end = i.End ?? at, category = i.Accounting(b.Mode), pause = i.Kind == "pause", i.Makeup, i.Reason }),
            checks = b.Checks.OrderBy(c => c.ScheduledAt).Select(c => new { c.ScheduledAt, c.Boundary, c.AnsweredAt, c.Answer })
        };
    }

    public static string Text(string? value, int max)
    {
        var text = value?.Trim() ?? "";
        if (text.Length > max) throw new InputError($"Text exceeds {max} characters.");
        return text;
    }

    public static async Task<Subject> Resolve(FocusDbContext db, SessionInfo info, bool historical = false)
    {
        if (info.SubjectId is { } id)
        {
            var subject = await db.Subjects.FindAsync(id) ?? throw new InputError("Unknown subject.");
            if (!historical && subject.State != "active") throw new InputError("Choose an active subject.");
            return subject;
        }
        var name = Text(info.Activity, 200);
        if (name.Length == 0) return await db.Subjects.FirstAsync(s => s.Id == 1);
        var key = name.ToUpperInvariant();
        var existing = await db.Subjects.FirstOrDefaultAsync(s => s.Kind == "activity" && s.NormalizedName == key);
        if (existing != null) return existing;
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
            edit.State is not ("active" or "completed" or "archived") || edit.EstimateMinutes is <= 0 ||
            edit.Kind == "activity" && (edit.EstimateMinutes != null || edit.State != "active"))
            throw new InputError("Provide a name and a positive optional to-do estimate.");
        if (!id.HasValue && edit.CreationKey == null) throw new InputError("Missing creation key.");
        if (!id.HasValue && await db.Subjects.AnyAsync(s => s.CreationKey == edit.CreationKey))
            return Results.NoContent();
        var subject = id.HasValue ? await db.Subjects.FindAsync(id.Value) : new Subject { Kind = edit.Kind, CreationKey = edit.CreationKey };
        if (subject == null) return Results.NotFound();
        if (subject.Kind != edit.Kind) throw new InputError("Subject type cannot change.");
        var key = name.ToUpperInvariant();
        if (edit.Kind == "activity" && await db.Subjects.AnyAsync(s => s.Kind == "activity" && s.NormalizedName == key && s.Id != subject.Id))
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
        app.MapGet("/api/journal", async (FocusDbContext db) =>
        {
            using var tx = await db.Database.BeginTransactionAsync();
            var blocks = await Detailed(db).AsNoTracking().OrderByDescending(b => b.StartedAt).ThenByDescending(b => b.Id).ToListAsync();
            return Results.Ok(new
            {
                sessions = blocks.Select(Row),
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
            block.Subject = await Resolve(db, edit, true);
            Describe(block, edit);
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
                await db.Set<BlockInterval>().AnyAsync(i => i.Start < edit.End && (i.End ?? now) > edit.Start))
                throw new InputError("That range overlaps a recorded interval. Choose an uncovered range.");
            db.PersonalIntervals.Add(new() { Id = edit.Id, Start = edit.Start, End = edit.End, Label = label });
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.NoContent();
        });
    }
}
