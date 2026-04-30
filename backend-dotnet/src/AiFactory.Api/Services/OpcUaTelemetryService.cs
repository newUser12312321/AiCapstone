using Microsoft.Extensions.Options;
using Opc.Ua;

namespace AiFactory.Api.Services;

public sealed class OpcUaOptions
{
    public bool Enabled { get; set; }
    public string EndpointUrl { get; set; } = "opc.tcp://127.0.0.1:4840";
    public List<string> NodeIds { get; set; } = [];
    public int SamplingIntervalSeconds { get; set; } = 10;
}

public sealed class OpcUaTelemetryService(
    ILogger<OpcUaTelemetryService> logger,
    IOptions<OpcUaOptions> options) : BackgroundService
{
    private readonly OpcUaOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            logger.LogInformation("OPC UA polling is disabled.");
            return;
        }

        // Full production connection/session setup should be added here.
        // This baseline worker validates NodeId format and periodically logs poll intent.
        var parsedNodeIds = _options.NodeIds
            .Select(NodeId.Parse)
            .ToList();

        logger.LogInformation(
            "OPC UA worker started. endpoint={Endpoint}, nodes={Count}",
            _options.EndpointUrl,
            parsedNodeIds.Count);

        while (!stoppingToken.IsCancellationRequested)
        {
            foreach (var nodeId in parsedNodeIds)
            {
                logger.LogDebug("Polling OPC UA node {NodeId} from {Endpoint}", nodeId, _options.EndpointUrl);
            }

            await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, _options.SamplingIntervalSeconds)), stoppingToken);
        }
    }
}
