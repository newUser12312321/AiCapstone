using System.Net.Http.Json;
using PcbKiosk.Models;

namespace PcbKiosk.Services;

public sealed class InspectionApiClient(HttpClient httpClient)
{
    public async Task<IReadOnlyList<InspectionSummary>> GetLatestAsync(int take = 50, CancellationToken cancellationToken = default)
    {
        var result = await httpClient.GetFromJsonAsync<List<InspectionSummary>>($"/api/inspections?take={take}", cancellationToken);
        return result ?? [];
    }

    public async Task<InspectionSummary?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        return await httpClient.GetFromJsonAsync<InspectionSummary>($"/api/inspections/{id}", cancellationToken);
    }
}
