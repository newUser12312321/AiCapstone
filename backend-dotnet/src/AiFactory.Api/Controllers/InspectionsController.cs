using AiFactory.Api.Contracts;
using AiFactory.Api.Data;
using AiFactory.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiFactory.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class InspectionsController(InspectionDbContext dbContext) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] InspectionIngestRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceId))
        {
            return BadRequest(new { message = "deviceId is required." });
        }

        var entity = new InspectionRecord
        {
            DeviceId = request.DeviceId.Trim(),
            Result = request.Result,
            Fiducial1X = request.Fiducial1X,
            Fiducial1Y = request.Fiducial1Y,
            Fiducial2X = request.Fiducial2X,
            Fiducial2Y = request.Fiducial2Y,
            Fiducial1XRaw = request.Fiducial1XRaw,
            Fiducial1YRaw = request.Fiducial1YRaw,
            Fiducial2XRaw = request.Fiducial2XRaw,
            Fiducial2YRaw = request.Fiducial2YRaw,
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

        dbContext.Inspections.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetOne), new { id = entity.Id }, new { id = entity.Id });
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? deviceId,
        [FromQuery] int take = 50,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);
        var query = dbContext.Inspections.AsNoTracking().Include(x => x.Defects).AsQueryable();

        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            query = query.Where(x => x.DeviceId == deviceId);
        }

        var items = await query
            .OrderByDescending(x => x.InspectedAt)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.DeviceId,
                x.Result,
                x.InspectedAt,
                x.InferenceTimeMs,
                x.TotalTimeMs,
                defectCount = x.Defects.Count,
                defects = x.Defects.Select(d => new
                {
                    d.Id,
                    d.DefectType,
                    d.Confidence,
                    d.BboxX,
                    d.BboxY,
                    d.BboxWidth,
                    d.BboxHeight
                })
            })
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetOne(long id, CancellationToken cancellationToken)
    {
        var item = await dbContext.Inspections.AsNoTracking()
            .Include(x => x.Defects)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (item is null)
        {
            return NotFound();
        }

        return Ok(item);
    }
}
