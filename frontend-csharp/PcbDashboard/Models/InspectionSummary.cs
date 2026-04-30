namespace PcbDashboard.Models;

public sealed class InspectionSummary
{
    public long Id { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string Result { get; set; } = string.Empty;
    public DateTimeOffset InspectedAt { get; set; }
    public double? AngleErrorDeg { get; set; }
    public int? InferenceTimeMs { get; set; }
    public int? TotalTimeMs { get; set; }
    public string? ImagePath { get; set; }
    public int DefectCount { get; set; }
    public List<DefectSummary> Defects { get; set; } = [];
}

public sealed class DefectSummary
{
    public long Id { get; set; }
    public string DefectType { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public int BboxX { get; set; }
    public int BboxY { get; set; }
    public int BboxWidth { get; set; }
    public int BboxHeight { get; set; }
}
