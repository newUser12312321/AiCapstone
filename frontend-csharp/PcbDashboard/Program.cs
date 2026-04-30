using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using PcbDashboard;
using PcbDashboard.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var configuredApiBaseUrl = builder.Configuration["ApiBaseUrl"];
var apiBaseUrl = configuredApiBaseUrl;

if (string.IsNullOrWhiteSpace(apiBaseUrl))
{
    apiBaseUrl = "http://localhost:8081";
}
else if (apiBaseUrl.Contains("localhost:5000", StringComparison.OrdinalIgnoreCase))
{
    // Docker compose deployment uses backend on host 8081.
    // Some clients may still receive stale appsettings with 5000.
    apiBaseUrl = "http://localhost:8081";
}

builder.Services.AddScoped(_ => new HttpClient { BaseAddress = new Uri(apiBaseUrl) });
builder.Services.AddScoped<InspectionApiClient>();

await builder.Build().RunAsync();
