using System.Net.Http.Json;
using Focus.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Focus.Api.Tests;

public class FoundationTests
{
    [Fact]
    public async Task Fresh_database_is_migrated_and_remains_healthy_after_restart()
    {
        var directory = Directory.CreateTempSubdirectory("focus-test-");
        try
        {
            for (var startup = 0; startup < 2; startup++)
            {
                await using var factory = new WebApplicationFactory<Program>()
                    .WithWebHostBuilder(builder => builder.UseSetting("Focus:DataDirectory", directory.FullName));
                using var client = factory.CreateClient();
                var health = await client.GetFromJsonAsync<Dictionary<string, string>>("/api/health");
                Assert.Equal("healthy", health?["status"]);
            }

            var options = new SqliteConnectionStringBuilder
            {
                DataSource = Path.Combine(directory.FullName, "focus.db"),
                Mode = SqliteOpenMode.ReadOnly
            };
            using var connection = new SqliteConnection(options.ToString());
            connection.Open();
            using var query = connection.CreateCommand();
            query.CommandText = "SELECT MigrationId FROM __EFMigrationsHistory WHERE MigrationId LIKE '%InitialFoundation'";
            Assert.EndsWith("InitialFoundation", Assert.IsType<string>(query.ExecuteScalar()));
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            directory.Delete(recursive: true);
        }
    }
}
