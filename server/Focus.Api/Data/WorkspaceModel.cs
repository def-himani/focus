namespace Focus.Api.Data;

public class Subject
{
    public int Id { get; set; }
    public string Kind { get; set; } = "activity";
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
    public int? EstimateMinutes { get; set; }
    public string State { get; set; } = "active";
    public Guid? CreationKey { get; set; }
}

public class StudyDay
{
    public int Id { get; set; }
    public long Start { get; set; }
    public long? End { get; set; }
    public string Zone { get; set; } = "UTC";
    public string Label { get; set; } = "";
}

public class PersonalInterval
{
    public Guid Id { get; set; }
    public long Start { get; set; }
    public long End { get; set; }
    public string Label { get; set; } = "";
}

public class DailyNote
{
    public string Date { get; set; } = "";
    public string Note { get; set; } = "";
}

public record SessionInfo(int? SubjectId = null, string? Activity = null, string Title = "", string Notes = "", string Tags = "", long? StopwatchOffMs = null);
public sealed class InputError(string message) : Exception(message);
