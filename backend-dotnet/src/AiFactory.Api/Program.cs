using AiFactory.Api.Data;
using AiFactory.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=inspection.db";
builder.Services.AddDbContext<InspectionDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.Configure<MqttOptions>(builder.Configuration.GetSection("Mqtt"));
builder.Services.Configure<OpcUaOptions>(builder.Configuration.GetSection("OpcUa"));
builder.Services.AddHostedService<MqttIngestService>();
builder.Services.AddHostedService<OpcUaTelemetryService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Dashboard", policy =>
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true));
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<InspectionDbContext>();
    db.Database.EnsureCreated();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("Dashboard");
app.MapControllers();

app.MapGet("/", () => Results.Ok(new
{
    service = "AiFactory.Api",
    message = "PCB inspection cloud backend is running"
}));

app.Run();
