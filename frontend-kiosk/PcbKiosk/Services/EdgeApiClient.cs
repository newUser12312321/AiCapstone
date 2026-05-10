using System.Net.Http.Json;

namespace PcbKiosk.Services;

public sealed class EdgeApiClient(HttpClient httpClient, string edgeBaseUrl)
{
    public string StreamUrl => $"{edgeBaseUrl.TrimEnd('/')}/edge/camera/stream.mjpg";

    /// <param name="kioskPreset">
    /// standard(실크 포함) | gt125a | gn948x — 후 둘은 엣지에서 실크·Gemini 생략 후 해당 가중치 사용.
    /// </param>
    public async Task TriggerInspectionAsync(string? kioskPreset = null, CancellationToken cancellationToken = default)
    {
        var q = string.IsNullOrWhiteSpace(kioskPreset) || string.Equals(kioskPreset, "standard", StringComparison.OrdinalIgnoreCase)
            ? string.Empty
            : $"?kioskPreset={Uri.EscapeDataString(kioskPreset.Trim())}";
        using var response = await httpClient.PostAsync($"/edge/inspect/trigger{q}", null, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task StartAutoInspectionAsync(double intervalSeconds = 3, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsync($"/edge/inspect/auto/start?interval={intervalSeconds}", null, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task StopAutoInspectionAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsync("/edge/inspect/auto/stop", null, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<CameraFocusStatus?> GetFocusStatusAsync(CancellationToken cancellationToken = default)
    {
        return await httpClient.GetFromJsonAsync<CameraFocusStatus>("/edge/camera/focus", cancellationToken);
    }

    public async Task SetFocusAsync(bool auto, int value, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync("/edge/camera/focus", new { auto, value }, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}

public sealed class CameraFocusStatus
{
    public bool Auto { get; set; }
    public int Value { get; set; }
}
