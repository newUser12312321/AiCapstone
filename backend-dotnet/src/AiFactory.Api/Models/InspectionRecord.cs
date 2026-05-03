namespace AiFactory.Api.Models;

public sealed class InspectionRecord
{
    public long Id { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public InspectionStatus Result { get; set; }
    public double? Fiducial1X { get; set; }
    public double? Fiducial1Y { get; set; }
    public double? Fiducial2X { get; set; }
    public double? Fiducial2Y { get; set; }
    public double? Fiducial1XRaw { get; set; }
    public double? Fiducial1YRaw { get; set; }
    public double? Fiducial2XRaw { get; set; }
    public double? Fiducial2YRaw { get; set; }
    public double? Fiducial1Confidence { get; set; }
    public double? Fiducial2Confidence { get; set; }
    public double? AngleErrorDeg { get; set; }
    public int? InferenceTimeMs { get; set; }
    public int? TotalTimeMs { get; set; }
    public string? ImagePath { get; set; }
    public DateTime InspectedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<DefectRecord> Defects { get; set; } = [];
}
