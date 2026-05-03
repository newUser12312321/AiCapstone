using System.Text.Json.Serialization;
using AiFactory.Api.Models;

namespace AiFactory.Api.Contracts;

public sealed class InspectionIngestRequest
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = string.Empty;

    [JsonPropertyName("result")]
    public InspectionStatus Result { get; set; }

    [JsonPropertyName("fiducial1X")]
    public double? Fiducial1X { get; set; }

    [JsonPropertyName("fiducial1Y")]
    public double? Fiducial1Y { get; set; }

    [JsonPropertyName("fiducial2X")]
    public double? Fiducial2X { get; set; }

    [JsonPropertyName("fiducial2Y")]
    public double? Fiducial2Y { get; set; }

    [JsonPropertyName("fiducial1XRaw")]
    public double? Fiducial1XRaw { get; set; }

    [JsonPropertyName("fiducial1YRaw")]
    public double? Fiducial1YRaw { get; set; }

    [JsonPropertyName("fiducial2XRaw")]
    public double? Fiducial2XRaw { get; set; }

    [JsonPropertyName("fiducial2YRaw")]
    public double? Fiducial2YRaw { get; set; }

    [JsonPropertyName("fiducial1Confidence")]
    public double? Fiducial1Confidence { get; set; }

    [JsonPropertyName("fiducial2Confidence")]
    public double? Fiducial2Confidence { get; set; }

    [JsonPropertyName("angleErrorDeg")]
    public double? AngleErrorDeg { get; set; }

    [JsonPropertyName("inferenceTimeMs")]
    public int? InferenceTimeMs { get; set; }

    [JsonPropertyName("totalTimeMs")]
    public int? TotalTimeMs { get; set; }

    [JsonPropertyName("imagePath")]
    public string? ImagePath { get; set; }

    [JsonPropertyName("inspectedAt")]
    public DateTimeOffset InspectedAt { get; set; } = DateTimeOffset.UtcNow;

    [JsonPropertyName("defects")]
    public List<DefectRequest> Defects { get; set; } = [];
}

public sealed class DefectRequest
{
    [JsonPropertyName("defectType")]
    public string DefectType { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("bboxX")]
    public double BboxX { get; set; }

    [JsonPropertyName("bboxY")]
    public double BboxY { get; set; }

    [JsonPropertyName("bboxWidth")]
    public double BboxWidth { get; set; }

    [JsonPropertyName("bboxHeight")]
    public double BboxHeight { get; set; }
}
