using System.Net.Http.Json;

namespace PcbDashboard.Services;

public sealed class EdgeApiClient(HttpClient httpClient, string edgeBaseUrl)
{
    public string StreamUrl => $"{edgeBaseUrl.TrimEnd('/')}/edge/camera/stream.mjpg";

    public async Task TriggerInspectionAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsync("/edge/inspect/trigger", null, cancellationToken);
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
