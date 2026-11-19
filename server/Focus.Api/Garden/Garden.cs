using Focus.Api.Data;
using Focus.Api.Timers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Focus.Api.Garden;

public class RewardRates
{
    public int SecondsPerCoin { get; set; } = 720;
    public int MinimumBonusMinutes { get; set; } = 25;
    public int BonusCap { get; set; } = 2;
}

public record PlantType(string Key, string Name, int Price, string Art);
public record Purchase(Guid Key, string PlantKey);

// Positive entries settle one focus block. Negative entries are purchase receipts and own one slot.
public class CoinEntry
{
    public long Id { get; set; }
    public int? TimerBlockId { get; set; }
    public int? StudyDayId { get; set; }
    public long Units { get; set; }
    public long VerifiedMs { get; set; }
    public bool QualifyingCompletion { get; set; }
    public int BonusCoins { get; set; }
    public Guid? PurchaseKey { get; set; }
    public string? PlantKey { get; set; }
    public int? Slot { get; set; }
}

public sealed class GardenService(FocusDbContext db, IOptions<RewardRates> options)
{
    public const long UnitsPerCoin = 720000;
    public static readonly PlantType[] Catalog = [
        new("cactus", "Desert cactus", 1, "cactus"),
        new("foliage", "Emerald foliage", 3, "potted_plant"),
        new("flowering-cactus", "Flowering cactus", 5, "cactus"),
        new("hyacinth", "Blue hyacinth", 8, "hyacinth")
    ];

    private Task<long> BalanceUnits() => db.Coins.SumAsync(e => e.Units);

    public async Task<long> UntilNextCoin(long effectiveMs)
    {
        var msPerCoin = options.Value.SecondsPerCoin * 1000L;
        var settled = await BalanceUnits() % UnitsPerCoin;
        var provisional = effectiveMs * UnitsPerCoin / msPerCoin;
        var nextThreshold = ((settled + provisional) / UnitsPerCoin + 1) * UnitsPerCoin - settled;
        return (nextThreshold * msPerCoin + UnitsPerCoin - 1) / UnitsPerCoin - effectiveMs;
    }

    private CoinEntry Reward(TimerBlock block, int previousCompletions)
    {
        var rate = options.Value;
        var verified = Attention.Total(block, "focus", block.EndedAt!.Value);
        var qualifies = block.Status == "completed" && verified >= block.TargetSeconds * 1000L
            && verified >= rate.MinimumBonusMinutes * 60000L && block.StudyDayId.HasValue;
        var bonus = qualifies ? Math.Min(rate.BonusCap, (previousCompletions + 1) / 2) : 0;
        return new CoinEntry
        {
            TimerBlockId = block.Id,
            StudyDayId = block.StudyDayId,
            VerifiedMs = verified,
            QualifyingCompletion = qualifies,
            BonusCoins = bonus,
            Units = verified * UnitsPerCoin / (rate.SecondsPerCoin * 1000L) + bonus * UnitsPerCoin
        };
    }

    // Called within the timer transaction, after the block has its persistent ID.
    public async Task<long> Settle(TimerBlock block)
    {
        if (block.Mode != "focus" || block.EndedAt == null) return 0;
        if (await db.Coins.AnyAsync(e => e.TimerBlockId == block.Id)) return 0;
        var previous = await db.Coins.CountAsync(e => e.StudyDayId == block.StudyDayId && e.QualifyingCompletion);
        var reward = Reward(block, previous);
        var before = await BalanceUnits();
        db.Coins.Add(reward);
        await db.SaveChangesAsync();
        return (before + reward.Units) / UnitsPerCoin - before / UnitsPerCoin;
    }

    public async Task CreditExistingSessions()
    {
        using var tx = await db.Database.BeginTransactionAsync();
        var missing = await db.Blocks.AsNoTracking().Include(b => b.Intervals)
            .Where(b => b.EndedAt != null && b.Mode == "focus" && !db.Coins.Any(c => c.TimerBlockId == b.Id))
            .OrderBy(b => b.EndedAt).ThenBy(b => b.Id).ToListAsync();
        if (missing.Count == 0) return;
        var counts = await db.Coins.Where(e => e.StudyDayId.HasValue && e.QualifyingCompletion)
            .GroupBy(e => e.StudyDayId!.Value).Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Day, g => g.Count);
        foreach (var block in missing)
        {
            var day = block.StudyDayId.GetValueOrDefault();
            var previous = counts.GetValueOrDefault(day);
            var reward = Reward(block, previous);
            db.Coins.Add(reward);
            if (reward.QualifyingCompletion) counts[day] = previous + 1;
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    public async Task<object> Snapshot()
    {
        var balance = await BalanceUnits();
        var plants = await db.Coins.Where(e => e.Slot != null).OrderBy(e => e.Slot)
            .Select(e => new { e.PlantKey, e.Slot }).ToListAsync();
        return new { balance = balance / UnitsPerCoin, progress = (balance % UnitsPerCoin) / (double)UnitsPerCoin, plants, catalog = Catalog };
    }

    public async Task<IResult> Read()
    {
        using var tx = await db.Database.BeginTransactionAsync();
        return Results.Ok(await Snapshot());
    }

    public async Task<IResult> Buy(Purchase request)
    {
        if (request.Key == Guid.Empty) throw new InputError("Missing purchase ID.");
        var plant = Catalog.SingleOrDefault(p => p.Key == request.PlantKey) ?? throw new InputError("Unknown plant.");
        using var tx = await db.Database.BeginTransactionAsync();
        var receipt = await db.Coins.SingleOrDefaultAsync(e => e.PurchaseKey == request.Key);
        if (receipt != null && receipt.PlantKey != plant.Key) throw new InputError("Purchase ID already used for a different plant.");
        if (receipt == null)
        {
            long cost = plant.Price * UnitsPerCoin;
            if (await BalanceUnits() < cost) throw new InputError("More coins are needed for this plant.");
            var slot = (await db.Coins.MaxAsync(e => e.Slot) ?? -1) + 1;
            db.Coins.Add(new CoinEntry { PurchaseKey = request.Key, PlantKey = plant.Key, Units = -cost, Slot = slot });
            await db.SaveChangesAsync();
        }
        var state = await Snapshot();
        await tx.CommitAsync();
        return Results.Ok(state);
    }
}
