using System.Text;
using System.Text.Json;
using AiFactory.Api.Contracts;
using AiFactory.Api.Data;
using AiFactory.Api.Models;
using Microsoft.Extensions.Options;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;

namespace AiFactory.Api.Services;

public sealed class MqttOptions
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1883;
    public string Topic { get; set; } = "factory/pcb/inspections";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public sealed class MqttIngestService(
    ILogger<MqttIngestService> logger,
    IServiceScopeFactory scopeFactory,
    IOptions<MqttOptions> options) : BackgroundService
{
    private readonly MqttOptions _options = options.Value;
    private readonly IMqttClient _client = new MqttFactory().CreateMqttClient();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            logger.LogInformation("MQTT ingest is disabled.");
            return;
        }

        _client.ApplicationMessageReceivedAsync += async e =>
        {
            try
            {
                var payload = Encoding.UTF8.GetString(e.ApplicationMessage.PayloadSegment);
                var request = JsonSerializer.Deserialize<InspectionIngestRequest>(payload);
                if (request is null)
                {
                    return;
                }

                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<InspectionDbContext>();
                await SaveInspectionAsync(db, request, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process MQTT message.");
            }
        };

        var clientOptions = new MqttClientOptionsBuilder()
            .WithTcpServer(_options.Host, _options.Port)
            .WithCredentials(_options.Username, _options.Password)
            .Build();

        await _client.ConnectAsync(clientOptions, stoppingToken);

        var topicFilter = new MqttTopicFilterBuilder()
            .WithTopic(_options.Topic)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .Build();

        await _client.SubscribeAsync(topicFilter, stoppingToken);

        logger.LogInformation("MQTT ingest connected to {Host}:{Port}, topic={Topic}.", _options.Host, _options.Port, _options.Topic);

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_client.IsConnected)
        {
            await _client.DisconnectAsync(cancellationToken: cancellationToken);
        }
        await base.StopAsync(cancellationToken);
    }

    private static async Task SaveInspectionAsync(InspectionDbContext db, InspectionIngestRequest request, CancellationToken cancellationToken)
    {
        var entity = new InspectionRecord
        {
            DeviceId = request.DeviceId,
            Result = request.Result,
            Fiducial1X = request.Fiducial1X,
            Fiducial1Y = request.Fiducial1Y,
            Fiducial2X = request.Fiducial2X,
            Fiducial2Y = request.Fiducial2Y,
            Fiducial1XRaw = request.Fiducial1XRaw,
            Fiducial1YRaw = request.Fiducial1YRaw,
            Fiducial2XRaw = request.Fiducial2XRaw,
            Fiducial2YRaw = request.Fiducial2YRaw,
            Fiducial1XYolo = request.Fiducial1XYolo,
            Fiducial1YYolo = request.Fiducial1YYolo,
            Fiducial2XYolo = request.Fiducial2XYolo,
            Fiducial2YYolo = request.Fiducial2YYolo,
            Fiducial1Confidence = request.Fiducial1Confidence,
            Fiducial2Confidence = request.Fiducial2Confidence,
            AngleErrorDeg = request.AngleErrorDeg,
            InferenceTimeMs = request.InferenceTimeMs,
            TotalTimeMs = request.TotalTimeMs,
            ImagePath = request.ImagePath,
            InspectedAt = request.InspectedAt.UtcDateTime,
            Defects = request.Defects.Select(d => new DefectRecord
            {
                DefectType = d.DefectType,
                Confidence = d.Confidence,
                BboxX = d.BboxX,
                BboxY = d.BboxY,
                BboxWidth = d.BboxWidth,
                BboxHeight = d.BboxHeight
            }).ToList()
        };

        db.Inspections.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
    }
}
