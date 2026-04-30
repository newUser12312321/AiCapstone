namespace AiFactory.Api.Models;

public sealed class DefectRecord
{
    public long Id { get; set; }
    public long InspectionRecordId { get; set; }
    public InspectionRecord? InspectionRecord { get; set; }
    public string DefectType { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public int BboxX { get; set; }
    public int BboxY { get; set; }
    public int BboxWidth { get; set; }
    public int BboxHeight { get; set; }
}
