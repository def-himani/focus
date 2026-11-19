using Focus.Api.Timers;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Data;

public sealed class FocusDbContext(DbContextOptions<FocusDbContext> options) : DbContext(options)
{
    public DbSet<TimerSettings> Settings => Set<TimerSettings>();
    public DbSet<TimerBlock> Blocks => Set<TimerBlock>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<TimerSettings>().HasData(new TimerSettings());
        model.Entity<TimerBlock>().HasIndex(b => new { b.Mode, b.EndedAt });
    }
}
