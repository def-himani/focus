using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Focus.Api.Timers;
using Focus.Api.Data;
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

    private async Task<JsonNode> Command(string action, long offMs = 0, string reason = "", SessionInfo? info = null)
    {
        using var response = await client.PostAsJsonAsync("/api/timer/" + action,
            new TimerCommand(revision, OffMs: offMs, Reason: reason, Session: info));
        response.EnsureSuccessStatusCode();
        var state = (await response.Content.ReadFromJsonAsync<JsonNode>())!;
        revision = (long)state["revision"]!;
        return state;
    }

    [Fact]
    public async Task Unanswered_check_in_restores_review_and_excludes_time_after_expiry()
    {
        clock.Now = DateTimeOffset.Parse("2026-01-02T16:00:00Z");
        await Act("settings", new(1800, 300, true, true, true, 600));
        var start = clock.Now.ToUnixTimeMilliseconds();
        await Act("start");
        clock.Now = clock.Now.AddMinutes(10);
        await Act("sync");
        await Command("answer");
        clock.Now = clock.Now.AddMinutes(10);
        await Act("sync");
        Restart();
        clock.Now = clock.Now.AddMinutes(100);
        var state = await Act("attach");
        var active = state["active"]!;
        Assert.Equal("review", (string?)state["status"]);
        Assert.Equal(1200000, (long)active["unverifiedMs"]!);
        Assert.Equal(600000, (long)active["effectiveMs"]!);
        Assert.Equal(start + 1800000, (long)active["countdownEnd"]!);
        Assert.Equal(2, active["checks"]!.AsArray().Count);
        Assert.Equal(start + 1200000, (long)active["checks"]![1]!["scheduledAt"]!);
        state = await Command("answer", 900000);
        Assert.Equal("choice", (string?)state["status"]);
        var row = (await Act("finish"))["history"]![0]!;
        Assert.Equal(900000, (long)row["effectiveMs"]!);
        Assert.Equal(900000, (long)row["offMs"]!);
        Assert.Equal(start + 1800000, (long)row["endedAt"]!);
    }

    [Fact]
    public async Task Make_up_keeps_one_session_and_distraction_history()
    {
        await Act("settings", new(1800, 300, false, false, false));
        var start = clock.Now.ToUnixTimeMilliseconds();
        await Act("start");
        clock.Now = clock.Now.AddMinutes(9);
        await Command("distraction", 420000);
        clock.Now = clock.Now.AddMinutes(21);
        var expired = await Act("sync");
        Assert.Equal(1380000, (long)expired["active"]!["effectiveMs"]!);
        await Act("makeup");
        clock.Now = clock.Now.AddMinutes(7);
        var row = Assert.Single((await Act("sync"))["history"]!.AsArray())!;
        Assert.Equal(1800000, (long)row["effectiveMs"]!);
        Assert.Equal(420000, (long)row["offMs"]!);
        Assert.Equal(start + 1800000, (long)row["countdownEnd"]!);
        Assert.Equal(start + 2220000, (long)row["endedAt"]!);
    }

    [Fact]
    public async Task Classified_pause_is_one_interval_and_reports_cannot_cross_it()
    {
        await Act("start");
        clock.Now = clock.Now.AddMinutes(5);
        await Act("pause");
        await Command("classify-pause", reason: "Off-task");
        clock.Now = clock.Now.AddMinutes(7);
        await Act("resume");
        clock.Now = clock.Now.AddMinutes(1);
        var invalid = await client.PostAsJsonAsync("/api/timer/distraction", new TimerCommand(revision, OffMs: 120000));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var row = (await Act("stop"))["history"]![0]!;
        Assert.Equal(420000, (long)row["pausedMs"]!);
        Assert.Equal(420000, (long)row["offMs"]!);
        Assert.Equal(360000, (long)row["effectiveMs"]!);
        Assert.Equal(1, (int)row["pauseCount"]!);
        Assert.Equal(3, row["intervals"]!.AsArray().Count);
    }

    [Fact]
    public async Task Subjects_history_and_study_day_survive_renaming_archival_and_restart()
    {
        var todo = new SubjectEdit("Book ABC", "todo", 900, CreationKey: Guid.NewGuid());
        var resp = await client.PostAsJsonAsync("/api/subjects", todo);
        resp.EnsureSuccessStatusCode();
        var id = (int)(await resp.Content.ReadFromJsonAsync<JsonNode>())!["id"]!;
        revision = (long)(await client.GetFromJsonAsync<JsonNode>("/api/timer"))!["revision"]!;
        await Act("settings", new(18000, 300, false, false, false));
        await Command("start", info: new(id, Title: "Chapter one", Notes: "Outline", Tags: "reading"));
        clock.Now = clock.Now.AddMinutes(200);
        var stopped = (await Act("stop"))["history"]![0]!;
        var dayId = (int)stopped["studyDayId"]!;
        var blockId = (int)stopped["id"]!;
        (await client.PutAsJsonAsync("/api/subjects/" + id, todo with { Name = "Revised book", State = "archived" })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync("/api/sessions/" + blockId, new SessionInfo(id, Title: "Revised chapter", Tags: "edited"))).EnsureSuccessStatusCode();
        revision = (long)(await client.GetFromJsonAsync<JsonNode>("/api/timer"))!["revision"]!;
        await Command("start", info: new(Activity: "Art"));
        clock.Now = clock.Now.AddMinutes(1);
        var art = (await Act("stop"))["history"]![0]!;
        await Command("start", info: new(Activity: "  art  "));
        clock.Now = clock.Now.AddMinutes(1);
        var next = (await Act("stop"))["history"]![0]!;
        Assert.Equal((int)art["subjectId"]!, (int)next["subjectId"]!);
        Assert.Equal(dayId, (int)next["studyDayId"]!);
        await Act("done");
        Restart();
        var journal = (await client.GetFromJsonAsync<JsonNode>("/api/journal"))!;
        var book = journal["sessions"]!.AsArray().Single(s => (int)s!["id"]! == blockId)!;
        Assert.Equal("Revised book", (string?)book["subject"]);
        Assert.Equal("Revised chapter", (string?)book["title"]);
        Assert.Equal(12000000, (long)book["effectiveMs"]!);
        Assert.NotNull(journal["days"]![0]!["end"]);
        var now = clock.Now.ToUnixTimeMilliseconds();
        var conflict = await client.PostAsJsonAsync("/api/personal", new PersonalEdit(Guid.NewGuid(), now - 1000, now, "Meal"));
        Assert.Equal(HttpStatusCode.BadRequest, conflict.StatusCode);
        var free = now - 86400000;
        (await client.PostAsJsonAsync("/api/personal", new PersonalEdit(Guid.NewGuid(), free - 60000, free, "Meal"))).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Interrupted_check_in_can_resume_without_credit_for_closed_time()
    {
        await Act("settings", new(1800, 300, true, true, true, 300));
        await Act("start");
        clock.Now = clock.Now.AddMinutes(5);
        await Act("sync");
        Restart();
        clock.Now = clock.Now.AddMinutes(3);
        var recovered = await Act("attach");
        Assert.Single(recovered["recoveries"]!.AsArray());
        Assert.Single(recovered["active"]!["checks"]!.AsArray());
        await Act("resume");
        clock.Now = clock.Now.AddMinutes(1);
        var review = await Act("stop");
        Assert.Equal("review", (string?)review["status"]);
        Assert.Equal(360000, (long)review["active"]!["unverifiedMs"]!);
        var finished = await Command("answer", 60000);
        var row = Assert.Single(finished["history"]!.AsArray())!;
        Assert.Equal("partial", (string?)row["status"]);
        Assert.Equal(300000, (long)row["effectiveMs"]!);
        Assert.Equal(60000, (long)row["offMs"]!);
        Assert.Equal(0, (long)row["pausedMs"]!);
        Assert.Equal("idle", (string?)finished["status"]);
    }

    [Fact]
    public async Task Close_all_preserves_each_interrupted_record_at_its_checkpoint()
    {
        await Act("start");
        clock.Now = clock.Now.AddMinutes(1);
        await Act("sync");
        // Exercise recovery of multiple outstanding records from an imported database.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<FocusDbContext>();
            var start = clock.Now.AddHours(-2).ToUnixTimeMilliseconds();
            db.Blocks.Add(new TimerBlock
            {
                StartedAt = start,
                PlannedSeconds = 1800,
                LastObservedAt = start + 2000,
                SubjectId = 1,
                StudyDayId = 1,
                Intervals = [new BlockInterval { Start = start }]
            });
            await db.SaveChangesAsync();
        }
        var pending = await Act("attach");
        Assert.Equal(2, pending["recoveries"]!.AsArray().Count);
        var closed = await Act("close-all");
        Assert.Empty(closed["recoveries"]!.AsArray());
        Assert.Equal(2, closed["history"]!.AsArray().Count);
        Assert.Equal(62000, closed["history"]!.AsArray().Sum(row => (long)row!["effectiveMs"]!));
    }

    [Fact]
    public async Task Done_closes_overnight_day_and_keeps_review_without_starting_a_new_cycle()
    {
        await Act("settings", new(1200, 300, true, true, true, 300));
        await Act("start");
        clock.Now = clock.Now.AddMinutes(21);
        var ended = await Act("done");
        Assert.Equal("review", (string?)ended["status"]);
        clock.Now = clock.Now.AddHours(1);
        var reviewed = await Command("answer");
        Assert.Equal("idle", (string?)reviewed["status"]);
        var row = Assert.Single(reviewed["history"]!.AsArray())!;
        Assert.Equal("completed", (string?)row["status"]);
        Assert.Equal(1200000, (long)row["effectiveMs"]!);
        var next = await Act("start");
        Assert.NotEqual((int)row["studyDayId"]!, (int)next["active"]!["studyDayId"]!);
    }

    [Fact]
    public async Task Late_distraction_applies_to_the_closed_countdown_before_cycling()
    {
        await Act("settings", new(60, 300, true, true, true));
        await Act("start");
        clock.Now = clock.Now.AddSeconds(62);
        var decision = await Command("distraction", 10000);
        Assert.Equal("choice", (string?)decision["status"]);
        Assert.Equal(50000, (long)decision["active"]!["effectiveMs"]!);
        Assert.Equal(10000, (long)decision["active"]!["offMs"]!);
    }

    private async Task<JsonNode> Garden() => (await client.GetFromJsonAsync<JsonNode>("/api/garden"))!;

    [Fact]
    public async Task Rewards_carry_fractional_partials_and_exclude_unverified_and_breaks()
    {
        for (int i = 0; i < 2; i++)
        {
            await Act("start");
            clock.Now = clock.Now.AddMinutes(6);
            await Act("stop");
        }
        Assert.Equal(1, (long)(await Garden())["balance"]!);
        await Act("settings", new(720, 720, false, true, false, 120));
        await Act("start");
        clock.Now = clock.Now.AddMinutes(12);
        await Act("sync");
        Assert.Equal(1, (long)(await Garden())["balance"]!);
        await Command("answer", 720000);
        await Act("finish");
        clock.Now = clock.Now.AddMinutes(12);
        await Act("sync");
        Restart();
        Assert.Equal(1, (long)(await Garden())["balance"]!);
    }

    [Fact]
    public async Task Bonuses_cap_across_breaks_and_midnight_then_reset_on_done()
    {
        long balance = 0;
        await Act("settings", new(2160, 60, true, true, true));
        foreach (var expected in new[] { 3, 4, 4, 5, 5 })
        {
            if (balance == 0) await Act("start");
            clock.Now = clock.Now.AddMinutes(36);
            var state = await Act("sync");
            Assert.Equal(expected, (long)state["earnedCoins"]!);
            balance += expected;
            clock.Now = clock.Now.AddMinutes(1);
            await Act("sync");
        }
        await Act("done");
        await Act("start");
        clock.Now = clock.Now.AddMinutes(36);
        Assert.Equal(3, (long)(await Act("sync"))["earnedCoins"]!);
        Assert.Equal(balance + 3, (long)(await Garden())["balance"]!);
    }

    [Fact]
    public async Task Make_up_settles_once_and_replaying_a_purchase_reuses_its_slot()
    {
        await Act("settings", new(720, 300, false, false, false));
        await Act("start");
        clock.Now = clock.Now.AddMinutes(5);
        await Command("distraction", 120000);
        clock.Now = clock.Now.AddMinutes(7);
        await Act("sync");
        Assert.Equal(0, (long)(await Garden())["balance"]!);
        await Act("makeup");
        clock.Now = clock.Now.AddMinutes(2);
        Assert.Equal(1, (long)(await Act("sync"))["earnedCoins"]!);
        var request = new { key = Guid.NewGuid(), plantKey = "cactus" };
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PostAsJsonAsync("/api/garden/purchases", request)));
        Assert.All(responses, r => r.EnsureSuccessStatusCode());
        Restart();
        var garden = await Garden();
        Assert.Equal(0, (long)garden["balance"]!);
        Assert.Equal(0, (int)Assert.Single(garden["plants"]!.AsArray())!["slot"]!);
        var changed = await client.PostAsJsonAsync("/api/garden/purchases", new { request.key, plantKey = "hyacinth" });
        Assert.Equal(HttpStatusCode.BadRequest, changed.StatusCode);
        var broke = await client.PostAsJsonAsync("/api/garden/purchases", new { key = Guid.NewGuid(), plantKey = "cactus" });
        Assert.Equal(HttpStatusCode.BadRequest, broke.StatusCode);
        Assert.Single((await Garden())["plants"]!.AsArray());
    }

    [Fact]
    public async Task Quick_start_continuation_and_extension_preserve_one_original_plan()
    {
        await Act("settings", new(720, 300, false, false, false));
        var started = await Command("quick", info: new(Activity: "Art", Title: "Sketch"));
        clock.Now = clock.Now.AddMinutes(2);
        Assert.Equal("starter-ended", (string?)(await Act("sync"))["status"]);
        clock.Now = clock.Now.AddHours(1);
        var continued = await Act("continue");
        Assert.Equal(600000, (long)continued["remainingMs"]!);
        Assert.Equal((int)started["active"]!["id"]!, (int)continued["active"]!["id"]!);
        clock.Now = clock.Now.AddMinutes(6);
        await Act("extend");
        clock.Now = clock.Now.AddMinutes(9);
        var row = Assert.Single((await Act("sync"))["history"]!.AsArray())!;
        Assert.Equal("Art", (string?)row["subject"]);
        Assert.Equal(120, (int)row["plannedSeconds"]!);
        Assert.Equal(1020, (int)row["targetSeconds"]!);
        Assert.Equal(1020000, (long)row["effectiveMs"]!);
        Assert.Equal(1, (long)(await Garden())["balance"]!);
    }

    [Fact]
    public async Task Back_to_task_cue_pauses_with_the_timer_and_never_extends_or_recredits_it()
    {
        await Act("settings", new(720, 300, false, false, false));
        var started = await Act("start");
        clock.Now = clock.Now.AddMinutes(11);
        await Command("distraction", 60000);
        var cue = await Act("refocus");
        Assert.Equal(60000, (long)cue["refocusMs"]!);
        Assert.Equal(60000, (long)cue["remainingMs"]!);
        clock.Now = clock.Now.AddSeconds(30);
        await Act("pause");
        clock.Now = clock.Now.AddMinutes(5);
        var resumed = await Act("resume");
        Assert.Equal(30000, (long)resumed["refocusMs"]!);
        clock.Now = clock.Now.AddSeconds(30);
        Assert.Equal("choice", (string?)(await Act("sync"))["status"]);
        var row = Assert.Single((await Act("finish"))["history"]!.AsArray())!;
        Assert.Equal((int)started["active"]!["id"]!, (int)row["id"]!);
        Assert.Equal(660000, (long)row["effectiveMs"]!);
        Assert.Equal(60000, (long)row["offMs"]!);
        Assert.Equal(300000, (long)row["pausedMs"]!);
        Assert.Equal(0, (long)(await Garden())["balance"]!);
    }

    [Fact]
    public async Task Concurrent_different_purchases_cannot_overdraw_the_wallet()
    {
        await Act("start");
        clock.Now = clock.Now.AddMinutes(12);
        await Act("stop");
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PostAsJsonAsync("/api/garden/purchases",
            new { key = Guid.NewGuid(), plantKey = "cactus" })));
        Assert.Single(results, r => r.IsSuccessStatusCode);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.BadRequest);
        Assert.Single((await Garden())["plants"]!.AsArray());
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();
        directory.Delete(true);
    }
}
