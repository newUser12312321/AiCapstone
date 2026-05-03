namespace AiFactory.Api.Models;

public sealed class DefectRecord
{
    public long Id { get; set; }
    public long InspectionRecordId { get; set; }
    public InspectionRecord? InspectionRecord { get; set; }
    public string DefectType { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public double BboxX { get; set; }
    public double BboxY { get; set; }
    public double BboxWidth { get; set; }
    public double BboxHeight { get; set; }
}
