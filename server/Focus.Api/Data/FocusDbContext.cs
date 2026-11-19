using Focus.Api.Timers;
using Focus.Api.Garden;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Data;

public sealed class FocusDbContext(DbContextOptions<FocusDbContext> options) : DbContext(options)
{
    public DbSet<CoinEntry> Coins => Set<CoinEntry>();
    public DbSet<TimerSettings> Settings => Set<TimerSettings>();
    public DbSet<TimerBlock> Blocks => Set<TimerBlock>();

    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<StudyDay> StudyDays => Set<StudyDay>();
    public DbSet<DailyNote> DailyNotes => Set<DailyNote>();
    public DbSet<PersonalInterval> PersonalIntervals => Set<PersonalInterval>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<CoinEntry>().HasIndex(c => c.TimerBlockId).IsUnique();
        model.Entity<CoinEntry>().HasIndex(c => c.PurchaseKey).IsUnique();
        model.Entity<CoinEntry>().HasIndex(c => c.Slot).IsUnique();
        model.Entity<CoinEntry>().HasOne<TimerBlock>().WithMany().HasForeignKey(c => c.TimerBlockId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<DailyNote>().HasKey(n => n.Date);
        model.Entity<Subject>().HasData(new Subject { Id = 1, Name = "General Study", NormalizedName = "GENERAL STUDY" });
        model.Entity<Subject>().HasIndex(s => s.NormalizedName).IsUnique().HasFilter("Kind = 'activity'");
        model.Entity<Subject>().HasIndex(s => s.CreationKey).IsUnique();
        model.Entity<TimerBlock>().HasOne(b => b.Subject).WithMany().HasForeignKey(b => b.SubjectId);
        model.Entity<TimerBlock>().HasOne(b => b.StudyDay).WithMany().HasForeignKey(b => b.StudyDayId);
        model.Entity<TimerSettings>().HasData(new TimerSettings());
        model.Entity<TimerBlock>().HasIndex(b => new { b.Mode, b.EndedAt });
    }
}
