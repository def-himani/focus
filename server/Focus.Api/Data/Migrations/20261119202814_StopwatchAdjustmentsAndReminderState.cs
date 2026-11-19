using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Focus.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class StopwatchAdjustmentsAndReminderState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ReminderMask",
                table: "Blocks",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "StopwatchAdjustment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TimerBlockId = table.Column<int>(type: "INTEGER", nullable: false),
                    Seconds = table.Column<int>(type: "INTEGER", nullable: false),
                    RecordedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StopwatchAdjustment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StopwatchAdjustment_Blocks_TimerBlockId",
                        column: x => x.TimerBlockId,
                        principalTable: "Blocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StopwatchAdjustment_TimerBlockId",
                table: "StopwatchAdjustment",
                column: "TimerBlockId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StopwatchAdjustment");

            migrationBuilder.DropColumn(
                name: "ReminderMask",
                table: "Blocks");
        }
    }
}
