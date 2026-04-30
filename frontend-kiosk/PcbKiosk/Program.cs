using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using PcbKiosk;
using PcbKiosk.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var cloudApi = builder.Configuration["ApiBaseUrl"] ?? "http://localhost:8081";
var edgeApi = builder.Configuration["EdgeBaseUrl"] ?? "http://localhost:8000";

builder.Services.AddScoped<InspectionApiClient>(_ => new InspectionApiClient(new HttpClient { BaseAddress = new Uri(cloudApi) }));
builder.Services.AddScoped<EdgeApiClient>(_ => new EdgeApiClient(new HttpClient { BaseAddress = new Uri(edgeApi) }, edgeApi));

await builder.Build().RunAsync();
