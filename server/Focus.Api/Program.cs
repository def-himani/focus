using Focus.Api.Data;
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

        var app = builder.Build();
        using (var scope = app.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<FocusDbContext>();
            await database.Database.MigrateAsync();
        }

        app.MapGet("/api/health", async (FocusDbContext database, CancellationToken cancellation) =>
            await database.Database.CanConnectAsync(cancellation)
                ? Results.Ok(new { status = "healthy" })
                : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

        await app.RunAsync();
    }
}
