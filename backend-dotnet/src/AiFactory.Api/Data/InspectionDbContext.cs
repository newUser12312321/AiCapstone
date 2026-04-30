using AiFactory.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AiFactory.Api.Data;

public sealed class InspectionDbContext(DbContextOptions<InspectionDbContext> options) : DbContext(options)
{
    public DbSet<InspectionRecord> Inspections => Set<InspectionRecord>();
    public DbSet<DefectRecord> Defects => Set<DefectRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InspectionRecord>(entity =>
        {
            entity.ToTable("inspection_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DeviceId).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Result).HasConversion<string>().HasMaxLength(16).IsRequired();
            entity.HasMany(x => x.Defects)
                .WithOne(x => x.InspectionRecord)
                .HasForeignKey(x => x.InspectionRecordId);
        });

        modelBuilder.Entity<DefectRecord>(entity =>
        {
            entity.ToTable("defect_records");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DefectType).HasMaxLength(80).IsRequired();
        });
    }
}
