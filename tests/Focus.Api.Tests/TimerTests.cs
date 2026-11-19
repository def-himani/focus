using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Focus.Api.Timers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Focus.Api.Tests;

public sealed class TimerTests : IDisposable
{
    private sealed class ManualClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-01-01T23:50:00Z");
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private readonly ManualClock clock = new();
    private readonly DirectoryInfo directory = Directory.CreateTempSubdirectory("focus-timer-");
    private WebApplicationFactory<Program> factory;
    private HttpClient client;
    private long revision;

    public TimerTests()
    {
        factory = Host();
        client = factory.CreateClient();
    }

    private WebApplicationFactory<Program> Host() => new WebApplicationFactory<Program>()
        .WithWebHostBuilder(b => b.UseSetting("Focus:DataDirectory", directory.FullName)
            .ConfigureServices(s => s.AddSingleton<TimeProvider>(clock)));

    private void Restart()
    {
        client.Dispose();
        factory.Dispose();
        factory = Host();
        client = factory.CreateClient();
    }

    private async Task<JsonNode> Act(string action, Preferences? preferences = null)
    {
        using var response = await client.PostAsJsonAsync("/api/timer/" + action, new TimerCommand(revision, preferences));
        response.EnsureSuccessStatusCode();
        var state = (await response.Content.ReadFromJsonAsync<JsonNode>())!;
        revision = (long)state["revision"]!;
        return state;
    }

    [Fact]
    public async Task Stop_early_preserves_target_and_excludes_pause_even_across_restart_and_midnight()
    {
        await Act("settings", new(1800, 300, true, true, true));
        await Act("start");
        clock.Now = clock.Now.AddMinutes(10);
        await Act("pause");
        Restart();
        clock.Now = clock.Now.AddMinutes(7);
        Assert.Equal(1200000L, (long)(await Act("sync"))["remainingMs"]!);
        await Act("resume");
        clock.Now = clock.Now.AddMinutes(13);
        await Act("settings", new(3000, 600, true, true, true));
        var state = await Act("stop");
        var row = Assert.Single(state["history"]!.AsArray())!;
        Assert.Equal(1800, (int)row["plannedSeconds"]!);
        Assert.Equal(23 * 60000L, (long)row["effectiveMs"]!);
        Assert.Equal(7 * 60000L, (long)row["pausedMs"]!);
        Assert.Equal("partial", (string?)row["status"]);
        Restart();
        var restored = await Act("attach");
        Assert.True(JsonNode.DeepEquals(state["history"], restored["history"]));
        Assert.Equal(3000000L, (long)restored["remainingMs"]!);
    }

    [Theory]
    [InlineData(true, true, true, "break", "running", "running")]
    [InlineData(true, false, false, "break", "idle", "idle")]
    [InlineData(false, true, true, "break", "running", "idle")]
    [InlineData(false, false, true, "focus", "idle", "idle")]
    public async Task Expiry_caps_work_and_respects_cycle_preferences(bool loop, bool autoBreak,
        bool autoFocus, string mode, string status, string afterBreak)
    {
        await Act("settings", new(2, 1, loop, autoBreak, autoFocus));
        var start = clock.Now.ToUnixTimeMilliseconds();
        await Act("start");
        clock.Now = clock.Now.AddMinutes(10);
        var state = await Act("sync");
        Assert.Equal(mode, (string?)state["mode"]);
        Assert.Equal(status, (string?)state["status"]);
        var row = Assert.Single(state["history"]!.AsArray())!;
        Assert.Equal(start + 2000, (long)row["endedAt"]!);
        Assert.Equal(2000, (long)row["effectiveMs"]!);
        Assert.Equal("completed", (string?)row["status"]);
        if (mode == "break")
        {
            if (status == "idle") await Act("start");
            clock.Now = clock.Now.AddSeconds(1);
            state = await Act("sync");
            Assert.Single(state["history"]!.AsArray());
            Assert.Equal("focus", (string?)state["mode"]);
            Assert.Equal(afterBreak, (string?)state["status"]);
        }
    }

    [Fact]
    public async Task Reopening_a_running_block_preserves_only_observed_time()
    {
        await Act("start");
        clock.Now = clock.Now.AddMilliseconds(1234);
        await Act("sync");
        Restart();
        clock.Now = clock.Now.AddHours(2);
        var state = await Act("attach");
        Assert.Equal("paused", (string?)state["status"]);
        Assert.Equal(2400000 - 1234, (long)state["remainingMs"]!);
        var row = (await Act("reset"))["history"]![0]!;
        Assert.Equal(1234, (long)row["effectiveMs"]!);
        Assert.Equal(0, (long)row["pausedMs"]!);
    }

    [Fact]
    public async Task Stale_or_concurrent_commands_cannot_create_duplicate_blocks()
    {
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ =>
            client.PostAsJsonAsync("/api/timer/start", new TimerCommand(0))));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        revision = 1;
        Assert.Single((await Act("stop"))["history"]!.AsArray());
    }

    [Fact]
    public async Task Invalid_duration_is_rejected_and_skipping_a_break_does_not_enter_focus_history()
    {
        using var invalid = await client.PostAsJsonAsync("/api/timer/settings",
            new TimerCommand(0, new(0, 86401, true, true, true)));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        await Act("settings", new(1, 300, true, true, false));
        await Act("start");
        clock.Now = clock.Now.AddSeconds(1);
        await Act("sync");
        var state = await Act("skip");
        Assert.Equal("focus", (string?)state["mode"]);
        Assert.Equal("idle", (string?)state["status"]);
        Assert.Single(state["history"]!.AsArray());
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();
        directory.Delete(true);
    }
}
