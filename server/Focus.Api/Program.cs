using Focus.Api.Data;
using Focus.Api.Garden;
using Focus.Api.Timers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Focus.Api;

public class Program
{
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddDbContext<FocusDbContext>((services, options) =>
        {
            var configuredDirectory = services.GetRequiredService<IConfiguration>()["Focus:DataDirectory"];
            var directory = configuredDirectory ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Focus");
            if (!Path.IsPathFullyQualified(directory))
                throw new InvalidOperationException("Focus data directory must be an absolute path.");

            Directory.CreateDirectory(directory);
            var connection = new SqliteConnectionStringBuilder
            {
                DataSource = Path.Combine(directory, "focus.db"),
                ForeignKeys = true
            };
            options.UseSqlite(connection.ToString());
        });

        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<TimerService>();
        builder.Services.AddScoped<GardenService>();
        builder.Services.AddOptions<RewardRates>().BindConfiguration("Focus:Rewards")
            .Validate(r => r.SecondsPerCoin is >= 1 and <= 86400 && r.MinimumBonusMinutes is >= 1 and <= 1440 && r.BonusCap is >= 0 and <= 10)
            .ValidateOnStart();
        var app = builder.Build();
        using (var scope = app.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FocusDbContext>();
            await database.Database.MigrateAsync();
            await scope.ServiceProvider.GetRequiredService<GardenService>().CreditExistingSessions();
        }

        app.Use(async (context, next) =>
        {
            try { await next(); }
            catch (InputError error)
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(error.Message);
            }
        });
        app.MapJournal();
        app.MapGet("/api/garden", (GardenService garden) => garden.Read());
        app.MapPost("/api/garden/purchases", (Purchase request, GardenService garden) => garden.Buy(request));
        app.MapGet("/api/health", async (FocusDbContext database, CancellationToken cancellation) =>
            await database.Database.CanConnectAsync(cancellation)
                ? Results.Ok(new { status = "healthy" })
                : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

        app.MapGet("/api/timer", (TimerService timer) => timer.Read());
        app.MapPost("/api/timer/{action}", (string action, TimerCommand command, TimerService timer) =>
            timer.Apply(action, command));
        await app.RunAsync();
    }
}
